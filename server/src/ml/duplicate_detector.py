"""
Nagrik Sahayak - AI Duplicate Complaint Detection
Uses Sentence Transformers ('all-MiniLM-L6-v2') + FAISS (IndexFlatIP with L2 normalization)
Computes cosine similarity against candidate complaints.
Includes scikit-learn TF-IDF fallback if transformer loading fails.
"""

import sys
import json
import os
import io

# Suppress Hugging Face / PyTorch noisy logs and force offline cache mode
os.environ["TOKENIZERS_PARALLELISM"] = "false"
os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"
os.environ["HF_HUB_OFFLINE"] = "1"
os.environ["TRANSFORMERS_OFFLINE"] = "1"
os.environ["TRANSFORMERS_VERBOSITY"] = "error"

import warnings
warnings.filterwarnings("ignore")

import numpy as np

def run_tfidf_fallback(query_text, candidates, threshold, top_k):
    try:
        from sklearn.feature_extraction.text import TfidfVectorizer
        from sklearn.metrics.pairwise import cosine_similarity
        
        corpus = [query_text] + [c.get("text", "") for c in candidates]
        vectorizer = TfidfVectorizer(ngram_range=(1, 2), stop_words="english")
        tfidf_matrix = vectorizer.fit_transform(corpus)
        
        sims = cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:])[0]
        
        matches = []
        for idx, score in enumerate(sims):
            val = float(score)
            if val >= threshold:
                c = candidates[idx]
                matches.append({
                    "id": c.get("id"),
                    "trackingId": c.get("trackingId"),
                    "title": c.get("title"),
                    "status": c.get("status"),
                    "category": c.get("category"),
                    "department": c.get("department"),
                    "createdAt": c.get("createdAt"),
                    "similarity": round(val, 4),
                    "method": "tfidf_fallback"
                })
        
        matches.sort(key=lambda x: x["similarity"], reverse=True)
        top_matches = matches[:top_k]
        highest = top_matches[0]["similarity"] if top_matches else 0.0
        
        return {
            "success": True,
            "isDuplicate": len(top_matches) > 0,
            "highestSimilarity": highest,
            "threshold": threshold,
            "duplicates": top_matches,
            "model": "tfidf_fallback"
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "isDuplicate": False,
            "highestSimilarity": 0.0,
            "threshold": threshold,
            "duplicates": [],
            "model": "none"
        }

def run_semantic_similarity(query_text, candidates, threshold=0.78, top_k=5):
    if not candidates or not query_text.strip():
        return {
            "success": True,
            "isDuplicate": False,
            "highestSimilarity": 0.0,
            "threshold": threshold,
            "duplicates": [],
            "model": "all-MiniLM-L6-v2"
        }
    
    try:
        from sentence_transformers import SentenceTransformer
        import faiss

        # Load embedding model
        model = SentenceTransformer("all-MiniLM-L6-v2")
        
        # Prepare texts
        candidate_texts = [c.get("text", "").strip() or c.get("title", "") for c in candidates]
        
        # Compute embeddings
        query_emb = model.encode([query_text], convert_to_numpy=True, show_progress_bar=False)
        candidate_embs = model.encode(candidate_texts, convert_to_numpy=True, show_progress_bar=False)
        
        # Normalize for cosine similarity using Inner Product
        faiss.normalize_L2(query_emb)
        faiss.normalize_L2(candidate_embs)
        
        dimension = query_emb.shape[1]
        index = faiss.IndexFlatIP(dimension)
        index.add(candidate_embs)
        
        k = min(top_k, len(candidates))
        distances, indices = index.search(query_emb, k)
        
        matches = []
        for dist, idx in zip(distances[0], indices[0]):
            sim = float(dist)
            if idx >= 0 and idx < len(candidates) and sim >= threshold:
                c = candidates[idx]
                matches.append({
                    "id": c.get("id"),
                    "trackingId": c.get("trackingId"),
                    "title": c.get("title"),
                    "status": c.get("status"),
                    "category": c.get("category"),
                    "department": c.get("department"),
                    "createdAt": c.get("createdAt"),
                    "similarity": round(sim, 4),
                    "method": "sentence-transformers-faiss"
                })
        
        matches.sort(key=lambda x: x["similarity"], reverse=True)
        highest = matches[0]["similarity"] if matches else (round(float(distances[0][0]), 4) if len(distances[0]) > 0 else 0.0)
        
        return {
            "success": True,
            "isDuplicate": len(matches) > 0,
            "highestSimilarity": highest,
            "threshold": threshold,
            "duplicates": matches,
            "model": "all-MiniLM-L6-v2"
        }
    except Exception as e:
        sys.stderr.write(f"SentenceTransformer/FAISS error: {e}. Falling back to TF-IDF.\n")
        return run_tfidf_fallback(query_text, candidates, threshold, top_k)

def main():
    try:
        raw_input = ""
        if len(sys.argv) > 1 and os.path.exists(sys.argv[1]):
            with open(sys.argv[1], "r", encoding="utf-8") as f:
                raw_input = f.read()
        else:
            raw_input = sys.stdin.read()
            
        if not raw_input.strip():
            print(json.dumps({"success": False, "error": "No input JSON provided"}))
            return
        
        payload = json.loads(raw_input)
        query = payload.get("query", {})
        query_title = query.get("title", "").strip()
        query_desc = query.get("description", "").strip()
        query_text = f"{query_title}. {query_desc}".strip()
        
        candidates = payload.get("candidates", [])
        threshold = float(payload.get("threshold", 0.78))
        top_k = int(payload.get("top_k", 5))
        
        result = run_semantic_similarity(query_text, candidates, threshold=threshold, top_k=top_k)
        print(json.dumps(result))
    except Exception as err:
        sys.stderr.write(f"Unexpected error in duplicate_detector: {err}\n")
        print(json.dumps({
            "success": False,
            "error": str(err),
            "isDuplicate": False,
            "highestSimilarity": 0.0,
            "threshold": 0.78,
            "duplicates": []
        }))

if __name__ == "__main__":
    main()
