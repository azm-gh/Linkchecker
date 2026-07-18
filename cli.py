import argparse
import sys
import asyncio
from colorama import init, Fore, Style
import crawler

# Initialize colorama
init(autoreset=True)

def parse_arguments():
    """Parses command-line arguments."""
    parser = argparse.ArgumentParser(description="Concurrent asyncio broken link checker with SQLite persistence.")
    parser.add_argument("url", help="The starting URL to extract links from.")
    parser.add_argument("-c", "--concurrency", type=int, default=50, help="Concurrency limit (default: 50)")
    parser.add_argument("-d", "--delay", type=float, default=0.0, help="Delay in seconds between starting requests (default: 0.0)")
    return parser.parse_args()

def on_init(data):
    if "error" in data:
        print(f"{Fore.RED}{data['error']}{Style.RESET_ALL}")
        sys.exit(1)
    print(f"{Fore.CYAN}{data['message']}{Style.RESET_ALL}\n")

def on_progress(result):
    url = result["target_url"]
    status_code = result["status_code"]
    error_message = result["error_message"]
    
    if result["is_alive"]:
        print(f"{Fore.GREEN}[{status_code}] OK - {url}{Style.RESET_ALL}")
    else:
        if error_message:
            if error_message == "Timeout":
                print(f"{Fore.YELLOW}[TIMEOUT] - {url}{Style.RESET_ALL}")
            else:
                print(f"{Fore.RED}[ERROR] {error_message} - {url}{Style.RESET_ALL}")
        else:
            print(f"{Fore.RED}[{status_code}] ERROR - {url}{Style.RESET_ALL}")

async def main_async():
    args = parse_arguments()
    print(f"{Fore.CYAN}Starting link checker for {args.url}{Style.RESET_ALL}")
    print(f"{Fore.CYAN}Concurrency: {args.concurrency} | Delay: {args.delay}s{Style.RESET_ALL}")
    
    summary = await crawler.run_crawl(
        start_url=args.url,
        concurrency=args.concurrency,
        delay=args.delay,
        on_progress=on_progress,
        on_init=on_init
    )
    
    if "error" in summary:
        return
        
    print("\n" + "="*40)
    print(f"{Fore.CYAN}Summary:{Style.RESET_ALL}")
    print(f"{Fore.GREEN}Alive links: {summary['alive']}{Style.RESET_ALL}")
    print(f"{Fore.RED}Dead/Error links: {summary['dead']}{Style.RESET_ALL}")
    print(f"{Fore.YELLOW}Total time: {summary['total_time_ms']}ms{Style.RESET_ALL}")
    print(f"{Fore.CYAN}Detailed results saved to links.db{Style.RESET_ALL}")
    print("="*40)

def main():
    if sys.platform.startswith('win'):
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(main_async())

if __name__ == "__main__":
    main()
