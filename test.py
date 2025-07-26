import ollama

models = ollama.list()
embedding_models = []
llm_models = []

for model in models:
    # Each model is a tuple: (provider, [model_info_dicts])
    for m in model[1]:
        # Heuristic: embedding models often have 'embedding' in their name or tags
        if "embedding" in m.get("model", "").lower() or "embedding" in m.get(
            "tags", []
        ):
            embedding_models.append(m.get("model", ""))
        else:
            llm_models.append(m.get("model", ""))

print("Embedding Models:")
for em in embedding_models:
    print(em)

print("\nLLM Models:")
for lm in llm_models:
    print(lm)
