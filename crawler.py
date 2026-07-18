import asyncio
import aiohttp
import time
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse

import db
import security

DEFAULT_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Safari/537.36"
)

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
        href = a_tag['href']
        full_url = urljoin(base_url, href)
        parsed_url = urlparse(full_url)
        if parsed_url.scheme in ('http', 'https'):
            if not security.is_domain_blocked(full_url):
                links.add(full_url)
    return list(links)

async def check_single_link(target_url, source_url, session, semaphore, timeout=10, on_progress=None):
    """Checks a single link, saves to DB, and triggers progress callback."""
    status_code = None
    error_message = None
    is_alive = False
    
    async with semaphore:
        start_time = time.time()
        try:
            async def _do_head():
                async with session.head(target_url, allow_redirects=True) as response:
                    return response.status

            async def _do_get():
                async with session.get(target_url, allow_redirects=True) as response:
                    return response.status

            status_code = await asyncio.wait_for(_do_head(), timeout=timeout)
            
            if status_code == 405:
                status_code = await asyncio.wait_for(_do_get(), timeout=timeout)
            
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
                response_time_ms=response_time_ms
            )
            
            result = {
                "target_url": target_url,
                "status_code": status_code,
                "error_message": error_message,
                "is_alive": is_alive,
                "response_time_ms": response_time_ms
            }
            
            if on_progress:
                if asyncio.iscoroutinefunction(on_progress):
                    await on_progress(result)
                else:
                    on_progress(result)
            
            return is_alive

async def run_crawl(start_url, concurrency=50, delay=0.0, on_progress=None, on_init=None):
    """Core engine that coordinates the crawling process."""
    db.init_db()
    headers = {"User-Agent": DEFAULT_USER_AGENT}
    
    crawl_start_time = time.time()
    
    # Apply security restrictions
    safe_concurrency = security.get_safe_concurrency(concurrency)
    
    async with aiohttp.ClientSession(headers=headers) as session:
        try:
            html = await fetch_html(start_url, session)
        except Exception as e:
            if on_init:
                if asyncio.iscoroutinefunction(on_init):
                    await on_init({"error": str(e)})
                else:
                    on_init({"error": str(e)})
            return {"error": str(e)}
            
        links = extract_links(html, start_url)
        
        if on_init:
            init_data = {
                "total_links": len(links), 
                "message": f"Found {len(links)} unique HTTP/HTTPS links (Security Concurrency Cap: {safe_concurrency})"
            }
            if asyncio.iscoroutinefunction(on_init):
                await on_init(init_data)
            else:
                on_init(init_data)
                
        if not links:
            return {"alive": 0, "dead": 0, "total": 0, "total_time_ms": int((time.time() - crawl_start_time) * 1000)}
            
        semaphore = asyncio.Semaphore(safe_concurrency)
        tasks = []
        
        for link in links:
            if delay > 0:
                await asyncio.sleep(delay)
            task = asyncio.create_task(check_single_link(link, start_url, session, semaphore, on_progress=on_progress))
            tasks.append(task)
        
        results = await asyncio.gather(*tasks)
        
        alive_count = sum(results)
        dead_count = len(results) - alive_count
        
        crawl_end_time = time.time()
        
        return {
            "alive": alive_count,
            "dead": dead_count,
            "total": len(results),
            "total_time_ms": int((crawl_end_time - crawl_start_time) * 1000)
        }
