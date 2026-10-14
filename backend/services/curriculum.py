"""
Sample DBMS curriculum — used by POST /seed.
Mirrors the prepared content in lib/demo.ts.
"""

INITIAL_TOPICS = [
    {
        "id": "intro",
        "name": "Introduction to DBMS",
        "page": 1,
        "prereq": "None",
        "text": (
            "A Database Management System (DBMS) is software that manages the storage, "
            "retrieval, and organisation of data. It provides an interface between users "
            "and the database. Key advantages include data independence, reduced redundancy, "
            "concurrent access, and data integrity. Popular DBMS examples include MySQL, "
            "PostgreSQL, Oracle, and SQLite."
        ),
        "example": (
            "A university stores student records in a DBMS rather than flat files so that "
            "multiple departments can query the same data without duplication."
        ),
    },
    {
        "id": "keys",
        "name": "Keys and Constraints",
        "page": 2,
        "prereq": "Introduction to DBMS",
        "text": (
            "A primary key uniquely identifies each row in a table and cannot contain NULL. "
            "A foreign key references the primary key of another table, enforcing referential "
            "integrity. A candidate key is any minimal set of attributes that uniquely "
            "identifies a row. A superkey is any superset of a candidate key. "
            "A primary key must be unique and cannot contain NULL. "
            "A composite key uses two or more columns together as the primary key."
        ),
        "example": (
            "In a Students table, student_id is the primary key. "
            "In an Enrolments table, student_id is a foreign key referencing Students."
        ),
    },
    {
        "id": "normalisation",
        "name": "Normalisation",
        "page": 3,
        "prereq": "Keys and Constraints",
        "text": (
            "Normalisation organises a relational database to reduce redundancy and improve "
            "data integrity. First Normal Form (1NF) requires atomic values and no repeating "
            "groups. Second Normal Form (2NF) requires 1NF and that every non-key attribute "
            "is fully functionally dependent on the whole primary key. Third Normal Form (3NF) "
            "requires 2NF and no transitive dependencies between non-key attributes."
        ),
        "example": (
            "A table with student_id, course_id, student_name violates 2NF if student_name "
            "depends only on student_id. Split it into Students(student_id, student_name) "
            "and Enrolments(student_id, course_id)."
        ),
    },
    {
        "id": "transactions",
        "name": "Transactions and ACID",
        "page": 4,
        "prereq": "Normalisation",
        "text": (
            "A transaction is an atomic unit of database work that must be fully completed "
            "or fully rolled back. ACID properties ensure reliability: Atomicity — all or "
            "nothing; Consistency — the database moves from one valid state to another; "
            "Isolation — concurrent transactions do not interfere; Durability — committed "
            "changes survive failures. The BEGIN, COMMIT, and ROLLBACK statements control "
            "transaction boundaries."
        ),
        "example": (
            "A bank transfer debits one account and credits another. Both operations must "
            "succeed together (atomicity) or neither should apply (rollback on failure)."
        ),
    },
]

# Prepared question bank — 18 questions across 4 topics.
QUESTION_BANK = [
    # intro
    {
        "id": "q_intro_1", "topic": "intro", "page": 1,
        "type": "MCQ", "difficulty": "Easy",
        "prompt": "What does DBMS stand for?",
        "options": ["Database Management System", "Data Backup Memory Store",
                    "Dynamic Binary Mapping Schema", "Distributed Business Module Suite"],
        "answer": "Database Management System",
        "explanation": "DBMS stands for Database Management System — software for managing stored data.",
        "citation": {"page": 1, "quote": "A Database Management System (DBMS) is software that manages the storage"},
    },
    {
        "id": "q_intro_2", "topic": "intro", "page": 1,
        "type": "Short answer", "difficulty": "Easy",
        "prompt": "Name one advantage of using a DBMS over flat files.",
        "answer": "reduced redundancy",
        "aliases": ["data independence", "concurrent access", "data integrity",
                    "reduce redundancy", "less redundancy"],
        "explanation": "DBMS advantages include data independence, reduced redundancy, concurrent access, and data integrity.",
        "citation": {"page": 1, "quote": "Key advantages include data independence, reduced redundancy"},
    },
    {
        "id": "q_intro_3", "topic": "intro", "page": 1,
        "type": "MCQ", "difficulty": "Medium",
        "prompt": "Which of the following is NOT a commonly cited advantage of a DBMS?",
        "options": ["Data independence", "Reduced redundancy",
                    "Increased file duplication", "Data integrity"],
        "answer": "Increased file duplication",
        "explanation": "A DBMS reduces (not increases) data duplication.",
        "citation": {"page": 1, "quote": "Key advantages include data independence, reduced redundancy"},
    },
    {
        "id": "q_intro_4", "topic": "intro", "page": 1,
        "type": "Short answer", "difficulty": "Medium",
        "prompt": "Give one example of a popular DBMS.",
        "answer": "MySQL",
        "aliases": ["PostgreSQL", "Oracle", "SQLite", "postgres", "sqlite"],
        "explanation": "Popular DBMS examples include MySQL, PostgreSQL, Oracle, and SQLite.",
        "citation": {"page": 1, "quote": "Popular DBMS examples include MySQL, PostgreSQL, Oracle, and SQLite"},
    },
    # keys
    {
        "id": "q_keys_1", "topic": "keys", "page": 2,
        "type": "MCQ", "difficulty": "Easy",
        "prompt": "Which constraint does a primary key enforce by default?",
        "options": ["NOT NULL and UNIQUE", "UNIQUE only", "NOT NULL only", "CHECK"],
        "answer": "NOT NULL and UNIQUE",
        "explanation": "A primary key must be unique and cannot contain NULL.",
        "citation": {"page": 2, "quote": "A primary key must be unique and cannot contain NULL"},
    },
    {
        "id": "q_keys_2", "topic": "keys", "page": 2,
        "type": "Short answer", "difficulty": "Easy",
        "prompt": "What is the purpose of a foreign key?",
        "answer": "referential integrity",
        "aliases": ["enforce referential integrity", "references another table",
                    "links tables", "reference primary key"],
        "explanation": "A foreign key references the primary key of another table, enforcing referential integrity.",
        "citation": {"page": 2, "quote": "A foreign key references the primary key of another table, enforcing referential integrity"},
    },
    {
        "id": "q_keys_3", "topic": "keys", "page": 2,
        "type": "MCQ", "difficulty": "Medium",
        "prompt": "A candidate key is best described as:",
        "options": [
            "Any minimal set of attributes that uniquely identifies a row",
            "Any superset of a primary key",
            "A key that allows NULL values",
            "A key made of exactly one column",
        ],
        "answer": "Any minimal set of attributes that uniquely identifies a row",
        "explanation": "A candidate key is any minimal set of attributes that uniquely identifies a row.",
        "citation": {"page": 2, "quote": "A candidate key is any minimal set of attributes that uniquely identifies a row"},
    },
    {
        "id": "q_keys_4", "topic": "keys", "page": 2,
        "type": "Short answer", "difficulty": "Medium",
        "prompt": "What is a composite key?",
        "answer": "two or more columns used together as the primary key",
        "aliases": ["multiple columns as primary key", "composite primary key",
                    "uses two or more columns"],
        "explanation": "A composite key uses two or more columns together as the primary key.",
        "citation": {"page": 2, "quote": "A composite key uses two or more columns together as the primary key"},
    },
    {
        "id": "q_keys_5", "topic": "keys", "page": 2,
        "type": "MCQ", "difficulty": "Medium",
        "prompt": "Which of the following is a superkey?",
        "options": [
            "Any superset of a candidate key",
            "Only the primary key",
            "A key that allows NULL values",
            "A foreign key referencing itself",
        ],
        "answer": "Any superset of a candidate key",
        "explanation": "A superkey is any superset of a candidate key.",
        "citation": {"page": 2, "quote": "A superkey is any superset of a candidate key"},
    },
    # normalisation
    {
        "id": "q_norm_1", "topic": "normalisation", "page": 3,
        "type": "Short answer", "difficulty": "Easy",
        "prompt": "What is the main goal of normalisation?",
        "answer": "reduce redundancy",
        "aliases": ["reduce data redundancy", "improve data integrity",
                    "reduce redundancy and improve data integrity", "eliminate redundancy"],
        "explanation": "Normalisation reduces redundancy and improves data integrity.",
        "citation": {"page": 3, "quote": "Normalisation organises a relational database to reduce redundancy and improve data integrity"},
    },
    {
        "id": "q_norm_2", "topic": "normalisation", "page": 3,
        "type": "MCQ", "difficulty": "Easy",
        "prompt": "Which normal form requires atomic values and no repeating groups?",
        "options": ["1NF", "2NF", "3NF", "BCNF"],
        "answer": "1NF",
        "explanation": "First Normal Form (1NF) requires atomic values and no repeating groups.",
        "citation": {"page": 3, "quote": "First Normal Form (1NF) requires atomic values and no repeating groups"},
    },
    {
        "id": "q_norm_3", "topic": "normalisation", "page": 3,
        "type": "MCQ", "difficulty": "Medium",
        "prompt": "2NF requires that every non-key attribute is fully functionally dependent on:",
        "options": ["The whole primary key", "Any single column", "A foreign key", "The row number"],
        "answer": "The whole primary key",
        "explanation": "2NF requires full functional dependency on the entire primary key.",
        "citation": {"page": 3, "quote": "every non-key attribute is fully functionally dependent on the whole primary key"},
    },
    {
        "id": "q_norm_4", "topic": "normalisation", "page": 3,
        "type": "Short answer", "difficulty": "Medium",
        "prompt": "What dependency does 3NF eliminate?",
        "answer": "transitive dependency",
        "aliases": ["transitive dependencies", "transitive functional dependency"],
        "explanation": "3NF eliminates transitive dependencies between non-key attributes.",
        "citation": {"page": 3, "quote": "no transitive dependencies between non-key attributes"},
    },
    # transactions
    {
        "id": "q_tx_1", "topic": "transactions", "page": 4,
        "type": "Short answer", "difficulty": "Easy",
        "prompt": "What does the 'A' in ACID stand for?",
        "answer": "Atomicity",
        "aliases": ["atomic", "atomicity property"],
        "explanation": "Atomicity means all operations in a transaction succeed or none apply.",
        "citation": {"page": 4, "quote": "Atomicity — all or nothing"},
    },
    {
        "id": "q_tx_2", "topic": "transactions", "page": 4,
        "type": "MCQ", "difficulty": "Easy",
        "prompt": "Which SQL statement rolls back a transaction?",
        "options": ["ROLLBACK", "UNDO", "ABORT", "RESET"],
        "answer": "ROLLBACK",
        "explanation": "ROLLBACK undoes all changes made in the current transaction.",
        "citation": {"page": 4, "quote": "The BEGIN, COMMIT, and ROLLBACK statements control transaction boundaries"},
    },
    {
        "id": "q_tx_3", "topic": "transactions", "page": 4,
        "type": "MCQ", "difficulty": "Medium",
        "prompt": "Isolation in ACID means that:",
        "options": [
            "Concurrent transactions do not interfere with each other",
            "The database always remains in one valid state",
            "Committed changes survive failures",
            "All operations succeed or none apply",
        ],
        "answer": "Concurrent transactions do not interfere with each other",
        "explanation": "Isolation ensures that concurrent transactions do not interfere.",
        "citation": {"page": 4, "quote": "Isolation — concurrent transactions do not interfere"},
    },
    {
        "id": "q_tx_4", "topic": "transactions", "page": 4,
        "type": "Numerical", "difficulty": "Easy",
        "prompt": "How many ACID properties are there?",
        "answer": "4",
        "explanation": "ACID has four properties: Atomicity, Consistency, Isolation, Durability.",
        "citation": {"page": 4, "quote": "ACID properties ensure reliability: Atomicity"},
    },
    {
        "id": "q_tx_5", "topic": "transactions", "page": 4,
        "type": "Short answer", "difficulty": "Medium",
        "prompt": "What ACID property guarantees committed changes survive system failures?",
        "answer": "Durability",
        "aliases": ["durability property", "D in acid"],
        "explanation": "Durability ensures committed changes survive failures.",
        "citation": {"page": 4, "quote": "Durability — committed changes survive failures"},
    },
]


def select_questions(
    topic: str,
    q_type: str,
    difficulty: str,
    count: int,
    seen_ids: list[str],
) -> list[dict]:
    """
    Filter the question bank and return `count` questions.
    Unseen questions are prioritised; seen ones fill the remainder.
    """
    pool = list(QUESTION_BANK)

    if topic != "all":
        pool = [q for q in pool if q["topic"] == topic]

    if q_type != "Mixed":
        pool = [q for q in pool if q["type"] == q_type]

    if difficulty != "Adaptive":
        pool = [q for q in pool if q["difficulty"] == difficulty]

    unseen = [q for q in pool if q["id"] not in seen_ids]
    repeated = [q for q in pool if q["id"] in seen_ids]

    def balance(items):
        if topic != "all":
            return items
        groups = [[q for q in items if q["topic"] == t["id"]] for t in INITIAL_TOPICS]
        return [group[i] for i in range(max((len(g) for g in groups), default=0))
                for group in groups if i < len(group)]

    return (balance(unseen) + balance(repeated))[:count]
