from langchain_core.tools import tool
import re
from typing import Optional

import requests
from bs4 import BeautifulSoup
from markdownify import markdownify as md


def _normalize_url(url: str) -> str:
    """Ensure the URL has a scheme; default to http if missing."""
    url = url.strip()
    if not re.match(r"^[a-zA-Z][a-zA-Z0-9+.-]*://", url):
        return f"http://{url}"
    return url


def _html_to_markdown(html: str, title: Optional[str] = None) -> str:
    """Convert HTML to Markdown and optionally prefix with a title."""
    # Use ATX headings (##) and standard bullets
    body_md = md(html or "", heading_style="ATX", bullets="*")
    body_md = body_md.strip()
    if title:
        return f"# {title}\n\n{body_md}" if body_md else f"# {title}"
    return body_md


@tool
def fetch(url: str) -> str:
    """
    Fetch a web page and return its contents as Markdown.

    Args:
            url (str): The URL to fetch. Scheme is optional (http will be assumed if missing).

    Returns:
            str: The page content converted to Markdown, or an error message if fetching fails.
    """
    try:
        normalized = _normalize_url(url)
        print(f"Fetching URL: `{normalized}`")

        resp = requests.get(normalized, timeout=15)
        resp.raise_for_status()

        # Parse and clean HTML
        soup = BeautifulSoup(resp.text, "html.parser")

        # Remove script/style/noscript elements to avoid noise
        for tag in soup(["script", "style", "noscript", "template"]):
            tag.decompose()

        title_tag = soup.find("title")
        title = title_tag.get_text(strip=True) if title_tag else None

        # Prefer main/article if present for better signal
        main = soup.find("main") or soup.find("article") or soup.body or soup
        markdown = _html_to_markdown(str(main), title=title)

        return (
            f"""<details closed>
            <summary>Fetch: `{url}`</summary>
			<pre>{markdown}</pre>
            </details>"""
            if markdown
            else "No readable content found."
        )
    except requests.exceptions.RequestException as e:
        return f"Failed to fetch URL: {e}"
    except Exception as e:
        return f"Failed to process page: {e}"
