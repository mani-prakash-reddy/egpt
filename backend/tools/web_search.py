from langchain_community.tools import DuckDuckGoSearchRun
from langchain_google_community import GoogleSearchAPIWrapper
from langchain_core.tools import tool
from dotenv import dotenv_values

env_vars = dotenv_values(dotenv_path="../../.env")


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
    if not env_vars.get("GOOGLE_CSE_ID") or not env_vars.get("GOOGLE_API_KEY"):
        search = DuckDuckGoSearchRun()
        results = search.invoke(query)
    else:
        search = GoogleSearchAPIWrapper(
            google_api_key=env_vars["GOOGLE_API_KEY"],
            google_cse_id=env_vars["GOOGLE_CSE_ID"],
            k=10,
        )
        results = search.run(query)

    return (
        f"""<details closed>
    <summary>Web search: `{query}`</summary>
    {results}
    </details>"""
        if results
        else "No results found."
    )
