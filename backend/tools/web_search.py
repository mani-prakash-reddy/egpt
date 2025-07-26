from langchain_community.tools import DuckDuckGoSearchResults
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
	search = DuckDuckGoSearchResults()
	results = search.run(query)
	
	return str(results) if results else "No results found."