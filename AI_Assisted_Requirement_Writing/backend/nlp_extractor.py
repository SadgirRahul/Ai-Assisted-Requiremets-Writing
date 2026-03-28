"""
nlp_extractor.py
Module for NLP processing: entity extraction, keyword extraction, and intent classification.
"""
import spacy
import nltk
from textblob import TextBlob
from typing import Dict, List, Tuple
from collections import Counter
from sklearn.feature_extraction.text import TfidfVectorizer
import re

# Download required NLTK data (run once)
try:
    nltk.data.find('tokenizers/punkt')
except LookupError:
    nltk.download('punkt')

try:
    nltk.data.find('corpora/stopwords')
except LookupError:
    nltk.download('stopwords')

from nltk.corpus import stopwords
from nltk.tokenize import word_tokenize

class NLPExtractor:
    def __init__(self):
        """Initialize NLP models and tools"""
        try:
            self.nlp = spacy.load("en_core_web_sm")
        except OSError:
            print("spaCy model 'en_core_web_sm' not found. Please install it with:")
            print("python -m spacy download en_core_web_sm")
            exit(1)
        
        self.stop_words = set(stopwords.words('english'))
        
    def extract_entities(self, text: str) -> Dict[str, List[str]]:
        """Extract named entities (people, organizations, locations, etc.)"""
        doc = self.nlp(text)
        entities = {
            'ORG': [],  # Organizations, systems, companies
            'GPE': [],  # Geopolitical entities (countries, cities, states)
            'PRODUCT': [],  # Products, applications, software
            'EVENT': [],
            'WORK_OF_ART': [],
            'LAW': [],
            'LANGUAGE': [],
            'MONEY': [],
            'QUANTITY': [],
            'ORDINAL': [],
            'CARDINAL': [],
            'SYSTEM': [],  # Custom category for systems
            'TITLE': []    # Custom category for titles/project names
        }
        
        for ent in doc.ents:
            # Reclassify PERSON entities that are actually systems/titles
            if ent.label_ == 'PERSON':
                # Check if it's likely a system name rather than a person
                if any(word in ent.text.lower() for word in ['system', 'application', 'software', 'platform', 'management', 'shopping', 'online']):
                    entities['SYSTEM'].append(ent.text)
                elif any(word in ent.text.lower() for word in ['project', 'requirements', 'specification']):
                    entities['TITLE'].append(ent.text)
                else:
                    entities['ORG'].append(ent.text)  # Default to ORG for unclear cases
            elif ent.label_ in entities:
                entities[ent.label_].append(ent.text)
        
        # Remove duplicates and empty lists
        return {k: list(set(v)) for k, v in entities.items() if v}
    
    def extract_keywords(self, text: str, top_k: int = 20) -> List[str]:
        """Extract important keywords using TF-IDF and POS tagging"""
        # Method 1: TF-IDF based keywords
        try:
            # Split text into sentences for better TF-IDF
            sentences = [sent.strip() for sent in text.split('.') if sent.strip()]
            if len(sentences) < 2:
                sentences = [text]
            
            tfidf = TfidfVectorizer(
                max_features=top_k,
                stop_words='english',
                ngram_range=(1, 2),  # Include bigrams
                lowercase=True
            )
            tfidf_matrix = tfidf.fit_transform(sentences)
            feature_names = tfidf.get_feature_names_out()
            tfidf_scores = tfidf_matrix.sum(axis=0).A1
            
            # Get top keywords by TF-IDF score
            keyword_scores = list(zip(feature_names, tfidf_scores))
            keyword_scores.sort(key=lambda x: x[1], reverse=True)
            tfidf_keywords = [kw for kw, score in keyword_scores[:top_k//2]]
        except:
            tfidf_keywords = []
        
        # Method 2: POS-based noun phrases
        doc = self.nlp(text)
        noun_phrases = []
        for chunk in doc.noun_chunks:
            if len(chunk.text.split()) <= 3:  # Keep phrases of reasonable length
                noun_phrases.append(chunk.text.lower())
        
        # Method 3: Important content words (nouns, adjectives, verbs)
        important_words = []
        for token in doc:
            if (token.pos_ in ['NOUN', 'ADJ', 'VERB'] and 
                not token.is_stop and 
                not token.is_punct and 
                len(token.text) > 2):
                important_words.append(token.lemma_.lower())
        
        # Combine and rank
        all_keywords = tfidf_keywords + noun_phrases + important_words
        keyword_freq = Counter(all_keywords)
        
        # Filter out very common words and return top keywords
        filtered_keywords = []
        for word, freq in keyword_freq.most_common(top_k):
            if word not in self.stop_words and len(word) > 2:
                filtered_keywords.append(word)
        
        return filtered_keywords[:top_k]
    
    def extract_actions_and_entities(self, text: str) -> Tuple[List[str], List[str]]:
        """Extract action verbs and their associated entities"""
        doc = self.nlp(text)
        
        actions = []
        entities = []
        
        for sent in doc.sents:
            # Extract action verbs (root verbs, not auxiliary)
            for token in sent:
                if (token.pos_ == 'VERB' and 
                    token.dep_ in ['ROOT', 'xcomp', 'ccomp'] and
                    token.lemma_ not in ['be', 'have', 'do', 'will', 'shall', 'can', 'may', 'must', 'should', 'could', 'would', 'might'] and
                    len(token.lemma_) > 2):
                    actions.append(token.lemma_.lower())
            
            # Extract noun entities from the sentence
            for chunk in sent.noun_chunks:
                if len(chunk.text.split()) <= 3:
                    entities.append(chunk.text.lower())
        
        # Remove duplicates
        actions = list(set(actions))
        entities = list(set(entities))
        
        return actions, entities
    
    def classify_intent(self, text: str) -> str:
        """Classify the intent of the text (functional, non-functional, etc.)"""
        # Simple rule-based classification
        functional_keywords = ['shall', 'must', 'will', 'should', 'require', 'need', 'function', 'feature', 'system']
        non_functional_keywords = ['performance', 'security', 'usability', 'reliability', 'availability', 'scalability', 'maintainability']
        
        text_lower = text.lower()
        
        functional_score = sum(1 for kw in functional_keywords if kw in text_lower)
        non_functional_score = sum(1 for kw in non_functional_keywords if kw in text_lower)
        
        if functional_score > non_functional_score:
            return "functional"
        elif non_functional_score > functional_score:
            return "non-functional"
        else:
            return "general"
    
    def analyze_text(self, text: str) -> Dict:
        """Complete text analysis pipeline"""
        return {
            'entities': self.extract_entities(text),
            'keywords': self.extract_keywords(text),
            'actions': self.extract_actions_and_entities(text)[0],
            'entities_list': self.extract_actions_and_entities(text)[1],
            'intent': self.classify_intent(text)
        }


# Test function
if __name__ == "__main__":
    extractor = NLPExtractor()
    
    sample_text = """
    The user management system shall allow administrators to create new user accounts. 
    The system must provide secure authentication mechanisms. 
    Performance requirements include response time under 2 seconds. 
    The application should be scalable to handle 1000 concurrent users.
    """
    
    analysis = extractor.analyze_text(sample_text)
    print("=== NLP Analysis Results ===")
    for key, value in analysis.items():
        print(f"{key}: {value}")
