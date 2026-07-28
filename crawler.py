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
    try:
        result = callback(data)
        if inspect.isawaitable(result):
            await result
    except Exception as e:
        print(f"Callback Error: {e}")

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
            # Strip fragments and trailing slashes for deduplication
            full_url = full_url.split('#')[0].rstrip('/')
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

async def _request_with_retries(session, method, url, timeout, retries=2):
    backoff = 0.5
    for i in range(retries + 1):
        try:
            async with session.request(method, url, allow_redirects=False, timeout=timeout) as resp:
                return resp.status, resp.headers.get('Location')
        except (aiohttp.ClientError, asyncio.TimeoutError):
            if i == retries:
                raise
            await asyncio.sleep(backoff * (2 ** i))

async def check_single_link(target_url, source_url, session, timeout=10, on_progress=None, user_id=None):
    """Checks a single link, saves to DB, and triggers progress callback."""
    status_code = None
    error_message = None
    is_alive = False
    
    start_time = time.time()
    client_timeout = aiohttp.ClientTimeout(total=timeout)
    current_url = target_url
    redirects = 0
    
    try:
        while redirects < 3:
            status_code, location = await _request_with_retries(session, 'HEAD', current_url, client_timeout)
            
            if status_code in (403, 405):
                status_code, location = await _request_with_retries(session, 'GET', current_url, client_timeout)
                
            if 300 <= status_code < 400 and location:
                next_url = urljoin(current_url, location)
                if not is_valid_url(next_url):
                    error_message = "Blocked Redirect (SSRF)"
                    status_code = 403
                    break
                current_url = next_url
                redirects += 1
            else:
                break
                
        if 200 <= status_code < 400:
            is_alive = True
            
    except asyncio.TimeoutError:
        error_message = "Timeout"
    except Exception as e:
        error_message = f"{type(e).__name__}: {str(e)}"
    finally:
        end_time = time.time()
        response_time_ms = int((end_time - start_time) * 1000)
        
        result = {
            "target_url": target_url,
            "source_url": source_url,
            "status_code": status_code,
            "error_message": error_message,
            "is_alive": is_alive,
            "response_time_ms": response_time_ms
        }
        
        await fire_callback(on_progress, result)
        
        return result

async def crawler_worker(queue, source_url, session, on_progress, user_id, delay, results_list):
    """Worker task that constantly pulls URLs from the queue."""
    while True:
        target_url = await queue.get()
        try:
            if target_url is None:
                break
            result = await check_single_link(
                target_url=target_url, 
                source_url=source_url, 
                session=session, 
                on_progress=on_progress, 
                user_id=user_id
            )
            results_list.append(result)
            
            if delay > 0:
                await asyncio.sleep(delay)
        finally:
            queue.task_done()

async def run_crawl(start_url, concurrency=50, delay=0.0, on_progress=None, on_init=None, user_id=None):
    """Core engine that coordinates the crawling process."""
    headers = {"User-Agent": DEFAULT_USER_AGENT}
    
    crawl_start_time = time.time()
    
    # Apply security restrictions
    safe_concurrency = security.get_safe_concurrency(concurrency)
    connector = aiohttp.TCPConnector(limit=safe_concurrency)
    
    async with aiohttp.ClientSession(headers=headers, connector=connector) as session:
        try:
            content = await fetch_html(start_url, session)
        except Exception as e:
            await fire_callback(on_init, {"error": str(e)})
            return {"error": str(e)}
            
        is_xml = start_url.lower().endswith('.xml') or content.strip().lower().startswith('<?xml') or '<urlset' in content.lower()
        
        if is_xml:
            links = extract_sitemap_links(content)
            source_type = "XML Sitemap"
        else:
            links = extract_links(content, start_url)
            source_type = "HTML Page"
            
        # Hard limit to prevent abuse
        original_link_count = len(links)
        links = links[:security.MAX_URLS]
        
        if on_init:
            init_data = {
                "total_links": len(links), 
                "message": f"Found {original_link_count} URLs (Capped at {security.MAX_URLS}). Security Concurrency: {safe_concurrency}"
            }
            await fire_callback(on_init, init_data)
                
        if not links:
            return {"alive": 0, "dead": 0, "total": 0, "total_time_ms": int((time.time() - crawl_start_time) * 1000)}
            
        queue = asyncio.Queue()
        for link in links:
            queue.put_nowait(link)
            
        num_workers = max(1, min(safe_concurrency, len(links)))
        
        # Enqueue sentinels to cleanly shutdown workers
        for _ in range(num_workers):
            queue.put_nowait(None)
            
        results_list = []
        workers = []
        
        # Spawn N worker tasks
        for _ in range(num_workers):
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
            
        # Block until the queue is completely processed, with a strict timeout
        try:
            await asyncio.wait_for(queue.join(), timeout=security.MAX_TIMEOUT)
        except asyncio.TimeoutError:
            pass # Timeout reached, we will process whatever results we have so far
        
        # Wait for workers to cleanly finish
        await asyncio.gather(*workers, return_exceptions=True)
        
        alive_count = sum(1 for r in results_list if r['is_alive'])
        dead_count = len(results_list) - alive_count
        
        crawl_end_time = time.time()
        total_time_ms = int((crawl_end_time - crawl_start_time) * 1000)
        
        # Save a single summary to the database
        await db.save_scan_summary(
            source_url=start_url,
            user_id=user_id,
            total_time_ms=total_time_ms,
            results=results_list
        )
        
        return {
            "alive": alive_count,
            "dead": dead_count,
            "total": len(results_list),
            "total_time_ms": total_time_ms
        }
