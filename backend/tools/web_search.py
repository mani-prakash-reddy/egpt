from langchain_community.tools import DuckDuckGoSearchRun
from langchain_core.tools import tool

@tool
def web_search(query: str) -> str:
    """
    Perform a web search using DuckDuckGo and return the results.

    Args:
            query (str): The search query.

    Returns:
            str: A string containing the search results.
    """
    print(f"Performing web search for query: `{query}`")
    search = DuckDuckGoSearchRun()
    results = search.invoke(query)

    return f"""<details closed>
    <summary>Web search: `{query}`</summary>
    {results}
    </details>""" if results else "No results found."