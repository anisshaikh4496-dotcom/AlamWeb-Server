from flask import Flask, render_template, redirect, url_for, request, jsonify, g
import sqlite3
from datetime import datetime
import os

app = Flask(__name__)

# Database setup (SQLite)
# Store all app data under a dedicated DataBase folder within the project root.
DB_DIR = os.path.join(os.path.dirname(__file__), 'DataBase')
# Ensure the DataBase directory exists
os.makedirs(DB_DIR, exist_ok=True)
DATABASE = os.path.join(DB_DIR, 'appdata.db')


def get_db():
    """Connects to the specific database."""
    db = getattr(g, '_database', None)
    if db is None:
        db = g._database = sqlite3.connect(DATABASE)
        db.row_factory = sqlite3.Row
    return db

def init_db():
    """Initializes the database structure."""
    db = get_db()
    cursor = db.cursor()
    # Contacts table
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS contacts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL,
            message TEXT,
            created_at TEXT NOT NULL
        )
        """
    )
    # Chat messages table: stores both user and bot messages
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS chats (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sender TEXT NOT NULL, -- 'user' or 'bot'
            message TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
        """
    )
    db.commit()


@app.teardown_appcontext
def close_connection(exception):
    """Closes the database connection at the end of the request."""
    db = getattr(g, '_database', None)
    if db is not None:
        db.close()

# Initialize DB on application startup
with app.app_context():
    init_db()


@app.route('/')
def home():
    return render_template('index.html')


@app.route('/submit_contact', methods=['POST'])
def submit_contact():
    # Expect JSON payload from AJAX
    try:
        data = request.get_json(force=True)
        name = (data.get('name') or '').strip()
        email = (data.get('email') or '').strip()
        message = (data.get('message') or '').strip()

        if not name or not email:
            return jsonify({'ok': False, 'error': 'Name and email are required.'}), 400

        db = get_db()
        cursor = db.cursor()
        cursor.execute(
            'INSERT INTO contacts (name, email, message, created_at) VALUES (?, ?, ?, ?)',
            (name, email, message, datetime.utcnow().isoformat())
        )
        db.commit()

        return jsonify({'ok': True, 'message': 'Thanks! Your message was received.'})
    except Exception as e:
        # Log server-side error and return generic message
        print('Contact submit error:', e)
        return jsonify({'ok': False, 'error': 'Server error'}), 500


@app.route('/chat_send', methods=['POST'])
def chat_send():
    """Accepts a JSON body { message: '...' } from the frontend chat widget,
    stores the user message, generates a bot reply (simple rule-based),
    stores the bot reply, and returns JSON { ok: True, reply: '...' }.
    """
    try:
        data = request.get_json(force=True)
        message = (data.get('message') or '').strip()
        if not message:
            return jsonify({'ok': False, 'error': 'Empty message'}), 400

        db = get_db()
        cur = db.cursor()
        # store user message
        cur.execute('INSERT INTO chats (sender, message, created_at) VALUES (?, ?, ?)',
                    ('user', message, datetime.utcnow().isoformat()))
        db.commit()

        # Basic rule-based bot reply (can be replaced with a smarter model or external API)
        msg_lower = message.lower()
        if any(greet in msg_lower for greet in ['hi', 'hello', 'hey']):
            reply = "Hello! How can I help you today? You can ask about projects, services, or hiring."
        elif 'project' in msg_lower or 'work' in msg_lower:
            reply = "I build full-stack and AI applications — check the Projects section for examples."
        elif 'hire' in msg_lower or 'hire me' in msg_lower or 'pricing' in msg_lower:
            reply = "Thanks for your interest! Please share a brief message about your requirements — I'll get back to you."
        elif 'help' in msg_lower or 'support' in msg_lower:
            reply = "Tell me more about the problem and I'll suggest a solution or next steps."
        else:
            # fallback reply
            reply = "Thanks for the message — I'll review it and respond soon. Can you share more details?"

        # persist bot reply
        cur.execute('INSERT INTO chats (sender, message, created_at) VALUES (?, ?, ?)',
                    ('bot', reply, datetime.utcnow().isoformat()))
        db.commit()

        return jsonify({'ok': True, 'reply': reply})
    except Exception as e:
        print('Chat send error:', e)
        return jsonify({'ok': False, 'error': 'Server error'}), 500


# Convenience routes for navbar links
@app.route('/projects')
def projects():
    return redirect(url_for('home') + '#projects')

@app.route('/expertise')
def expertise():
    return redirect(url_for('home') + '#expertise')

@app.route('/about')
def about():
    return redirect(url_for('home') + '#about')

@app.route('/contact')
def contact():
    return redirect(url_for('home') + '#contact')

@app.route('/home')
def home_alias():
    return redirect(url_for('home'))

if __name__ == '__main__':
    print("🚀 Flask server running for local development.")
    # We use 0.0.0.0 for development binding, but Gunicorn overrides this for production.
    app.run(debug=True, host='0.0.0.0', port=5000)
