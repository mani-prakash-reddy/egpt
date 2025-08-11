import pandas as pd
import plotly.express as px
from langchain_core.tools import tool
from typing import Type
from pydantic import BaseModel, Field


# Define the input schema for the tool
class PlottingToolInput(BaseModel):
    code: str = Field(
        description="A Python script that generates a Plotly figure. The script MUST create a figure object named 'fig'."
    )


@tool
def plot_tool(code: PlottingToolInput) -> str:
    """
    Generate a Plotly plot from the provided code.
    Use this tool to generate plots using Python's Plotly library.
    Your input should be a valid Python script that creates a Plotly figure object named 'fig'.
    The tool will return an HTML string representation of the plot.
    You have access to pandas (as pd) and plotly.express (as px).

    Args:
            code (PlottingToolInput): A Python script that generates a Plotly figure.
                                                              The script MUST create a figure object named 'fig'.

    Returns:
            str: An HTML code string representation of the plot.
    """
    try:
        # Create a local scope for exec to run in
        local_scope = {"pd": pd, "px": px}

        # Execute the user-provided code
        exec(code.code, {}, local_scope)

        # Retrieve the figure object from the local scope
        fig = local_scope.get("fig")

        if fig is None:
            return "Error: The provided code did not create a 'fig' object."

        # Convert the figure to an HTML string
        return fig.to_html(full_html=False, include_plotlyjs="cdn")

    except Exception as e:
        return f"An error occurred: {e}"

