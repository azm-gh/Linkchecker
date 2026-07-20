import asyncio
import aiohttp
import time
import inspect
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse

import db
import security

DEFAULT_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Safari/537.36"
)

def is_valid_url(url):
    parsed = urlparse(url)
    return parsed.scheme in ('http', 'https') and not security.is_domain_blocked(url)

async def fire_callback(callback, data):
    if not callback:
        return
    if inspect.iscoroutinefunction(callback):
        await callback(data)
    else:
        callback(data)

async def fetch_html(url, session):
    """Fetches the HTML content of the starting URL."""
    try:
        async with session.get(url, timeout=10) as response:
            response.raise_for_status()
            return await response.text()
    except Exception as e:
        raise Exception(f"Error fetching the starting URL: {e}")

def extract_links(html_content, base_url):
    """Extracts all unique HTTP/HTTPS links from the HTML."""
    soup = BeautifulSoup(html_content, 'html.parser')
    links = set()
    for a_tag in soup.find_all('a', href=True):
        href = a_tag.get('href')
        if href:
            full_url = urljoin(base_url, href)
            if is_valid_url(full_url):
                links.add(full_url)
    return list(links)

def extract_sitemap_links(xml_content):
    """Extracts URLs from an XML sitemap."""
    soup = BeautifulSoup(xml_content, 'xml')
    links = set()
    for loc in soup.find_all('loc'):
        url = loc.text.strip()
        if is_valid_url(url):
            links.add(url)
    return list(links)

async def check_single_link(target_url, source_url, session, timeout=10, on_progress=None, user_id=None):
    """Checks a single link, saves to DB, and triggers progress callback."""
    status_code = None
    error_message = None
    is_alive = False
    
    start_time = time.time()
    client_timeout = aiohttp.ClientTimeout(total=timeout)
    try:
        async with session.head(target_url, allow_redirects=True, timeout=client_timeout) as response:
            status_code = response.status
            
        if status_code == 405:
            async with session.get(target_url, allow_redirects=True, timeout=client_timeout) as response:
                status_code = response.status
                
        if 200 <= status_code < 400:
            is_alive = True
            
    except asyncio.TimeoutError:
        error_message = "Timeout"
    except Exception as e:
        error_message = type(e).__name__
    finally:
        end_time = time.time()
        response_time_ms = int((end_time - start_time) * 1000)
        
        # Persist to database
        db.save_link_check(
            target_url=target_url,
            source_url=source_url,
            status_code=status_code,
            error_message=error_message,
            is_alive=is_alive,
            response_time_ms=response_time_ms,
            user_id=user_id
        )
        
        result = {
            "target_url": target_url,
            "status_code": status_code,
            "error_message": error_message,
            "is_alive": is_alive,
            "response_time_ms": response_time_ms
        }
        
        await fire_callback(on_progress, result)
        
        return is_alive

async def crawler_worker(queue, source_url, session, on_progress, user_id, delay, results_list):
    """Worker task that constantly pulls URLs from the queue."""
    while True:
        target_url = await queue.get()
        try:
            is_alive = await check_single_link(
                target_url=target_url, 
                source_url=source_url, 
                session=session, 
                on_progress=on_progress, 
                user_id=user_id
            )
            results_list.append(is_alive)
            
            if delay > 0:
                await asyncio.sleep(delay)
        finally:
            queue.task_done()

async def run_crawl(start_url, concurrency=50, delay=0.0, on_progress=None, on_init=None, user_id=None):
    """Core engine that coordinates the crawling process."""
    db.init_db()
    headers = {"User-Agent": DEFAULT_USER_AGENT}
    
    crawl_start_time = time.time()
    
    # Apply security restrictions
    safe_concurrency = security.get_safe_concurrency(concurrency)
    
    async with aiohttp.ClientSession(headers=headers) as session:
        try:
            content = await fetch_html(start_url, session)
        except Exception as e:
            await fire_callback(on_init, {"error": str(e)})
            return {"error": str(e)}
            
        is_xml = start_url.lower().endswith('.xml') or content.strip().startswith('<?xml') or '<urlset' in content
        
        if is_xml:
            links = extract_sitemap_links(content)
            source_type = "XML Sitemap"
        else:
            links = extract_links(content, start_url)
            source_type = "HTML Page"
        
        if on_init:
            init_data = {
                "total_links": len(links), 
                "message": f"Found {len(links)} URLs in {source_type} (Security Concurrency Cap: {safe_concurrency})"
            }
            await fire_callback(on_init, init_data)
                
        if not links:
            return {"alive": 0, "dead": 0, "total": 0, "total_time_ms": int((time.time() - crawl_start_time) * 1000)}
            
        queue = asyncio.Queue()
        for link in links:
            queue.put_nowait(link)
            
        results_list = []
        workers = []
        
        # Spawn N worker tasks
        for _ in range(safe_concurrency):
            worker = asyncio.create_task(crawler_worker(
                queue=queue, 
                source_url=start_url, 
                session=session, 
                on_progress=on_progress, 
                user_id=user_id, 
                delay=delay, 
                results_list=results_list
            ))
            workers.append(worker)
            
        # Block until the queue is completely processed
        await queue.join()
        
        # Cancel all worker tasks since they are infinite loops
        for worker in workers:
            worker.cancel()
        
        alive_count = sum(results_list)
        dead_count = len(results_list) - alive_count
        
        crawl_end_time = time.time()
        
        return {
            "alive": alive_count,
            "dead": dead_count,
            "total": len(results_list),
            "total_time_ms": int((crawl_end_time - crawl_start_time) * 1000)
        }
