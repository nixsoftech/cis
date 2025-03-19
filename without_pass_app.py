from flask import Flask, jsonify, request
from flask_jwt_extended import JWTManager, jwt_required, get_jwt_identity, create_access_token
from pymongo import MongoClient
from flask_cors import CORS
import logging
import traceback
import urllib.parse

app = Flask(__name__)
app.config['JWT_SECRET_KEY'] = 'poc-secret-key'  # Simple key for PoC; change for production
jwt = JWTManager(app)
CORS(app, resources={r"/api/*": {"origins": "http://192.168.142.91"}})  # Adjust for your frontend URL

# MongoDB credentials
mongo_username = "lynis_user"
mongo_password = "lynis_pass123"
mongo_db = "lynis_db"
mongo_host = "localhost"
mongo_port = 27017

escaped_username = urllib.parse.quote_plus(mongo_username)
escaped_password = urllib.parse.quote_plus(mongo_password)
mongo_uri = f"mongodb://{escaped_username}:{escaped_password}@{mongo_host}:{mongo_port}/{mongo_db}?authSource={mongo_db}"

try:
    client = MongoClient(mongo_uri, serverSelectionTimeoutMS=5000)
    client.server_info()  # Test connection
    db = client[mongo_db]
    servers_collection = db['scan_results']
    users_collection = db['users']
except Exception as e:
    print(f"Failed to connect to MongoDB: {e}")
    raise

# Configure logging
logging.basicConfig(level=logging.INFO)
app.logger.handlers = logging.getLogger().handlers

@app.route('/api/login', methods=['POST'])
def login():
    try:
        data = request.get_json()
        if not data or "username" not in data or "password" not in data:
            return jsonify({"error": "Username and password are required"}), 400
        
        app.logger.info(f"Login attempt for username: {data['username']}")
        user = users_collection.find_one({"username": data["username"], "password": data["password"]})
        if not user:
            app.logger.warning(f"Invalid credentials for username: {data['username']}")
            return jsonify({"error": "Invalid credentials"}), 401
        
        access_token = create_access_token(identity=data["username"])
        app.logger.info(f"Login successful for username: {data['username']}")
        return jsonify({
            "access_token": access_token,
            "username": data["username"],
            "role": user.get("role", "viewer")
        })
    except Exception as e:
        app.logger.error(f"Login error: {str(e)}\n{traceback.format_exc()}")
        return jsonify({"error": "Internal server error"}), 500

@app.route('/api/submit_scan', methods=['POST'])
@jwt_required()
def submit_scan():
    try:
        data = request.get_json()
        if not data or "server_id" not in data:
            return jsonify({"error": "server_id is required"}), 400
        
        server_id = data["server_id"]
        result = servers_collection.update_one(
            {"server_id": server_id},
            {"$set": data},
            upsert=True
        )
        app.logger.info(f"Updated scan data for server_id: {server_id}, matched: {result.matched_count}, modified: {result.modified_count}")
        return jsonify({"message": "Scan data updated"})
    except Exception as e:
        app.logger.error(f"Submit scan error: {str(e)}\n{traceback.format_exc()}")
        return jsonify({"error": "Internal server error"}), 500

@app.route('/api/servers', methods=['GET'])
@jwt_required()
def get_servers():
    try:
        current_user = get_jwt_identity()
        user = users_collection.find_one({"username": current_user})
        if not user:
            return jsonify({"error": "User not found"}), 404
        
        pipeline = [
            {"$sort": {"timestamp": -1}},
            {"$group": {"_id": "$server_id", "latest": {"$first": "$$ROOT"}}},
            {"$replaceRoot": {"newRoot": "$latest"}}
        ]
        if user.get("role") != "admin":
            pipeline.append({"$match": {"server_id": {"$in": user.get("servers", [])}}})
        
        servers = list(servers_collection.aggregate(pipeline))
        for server in servers:
            server["_id"] = str(server["_id"])
        app.logger.info(f"Fetched {len(servers)} servers for user: {current_user}")
        return jsonify(servers)
    except Exception as e:
        app.logger.error(f"Get servers error: {str(e)}\n{traceback.format_exc()}")
        return jsonify({"error": "Internal server error"}), 500

@app.route('/api/all_servers', methods=['GET'])
@jwt_required()
def get_all_servers():
    try:
        current_user = get_jwt_identity()
        user = users_collection.find_one({"username": current_user})
        if not user or user.get("role") != "admin":
            return jsonify({"error": "Unauthorized"}), 403
        
        pipeline = [
            {"$sort": {"timestamp": -1}},
            {"$group": {"_id": "$server_id", "latest": {"$first": "$$ROOT"}}},
            {"$replaceRoot": {"newRoot": "$latest"}}
        ]
        servers = list(servers_collection.aggregate(pipeline))
        for server in servers:
            server["_id"] = str(server["_id"])
        app.logger.info(f"Fetched {len(servers)} servers (all) for admin: {current_user}")
        return jsonify(servers)
    except Exception as e:
        app.logger.error(f"Get all servers error: {str(e)}\n{traceback.format_exc()}")
        return jsonify({"error": "Internal server error"}), 500

@app.route('/api/signup', methods=['POST'])
@jwt_required()
def signup():
    try:
        current_user = get_jwt_identity()
        user = users_collection.find_one({"username": current_user})
        if not user or user.get("role") != "admin":
            return jsonify({"error": "Unauthorized"}), 403
        
        data = request.get_json()
        if not data or "username" not in data or "password" not in data:
            return jsonify({"error": "Username and password are required"}), 400
        
        if users_collection.find_one({"username": data["username"]}):
            return jsonify({"error": "Username already exists"}), 400
        
        new_user = {
            "username": data["username"],
            "password": data["password"],  # Plaintext for PoC
            "role": data.get("role", "viewer"),
            "servers": data.get("servers", [])
        }
        users_collection.insert_one(new_user)
        app.logger.info(f"Created new user: {data['username']} by admin: {current_user}")
        return jsonify({"message": "User created successfully"})
    except Exception as e:
        app.logger.error(f"Signup error: {str(e)}\n{traceback.format_exc()}")
        return jsonify({"error": "Internal server error"}), 500

@app.route('/api/users', methods=['GET'])
@jwt_required()
def get_users():
    try:
        current_user = get_jwt_identity()
        user = users_collection.find_one({"username": current_user})
        if not user or user.get("role") != "admin":
            return jsonify({"error": "Unauthorized"}), 403
        
        users = list(users_collection.find({}, {"password": 0}))
        for u in users:
            u["_id"] = str(u["_id"])
        app.logger.info(f"Fetched {len(users)} users for admin: {current_user}")
        return jsonify(users)
    except Exception as e:
        app.logger.error(f"Get users error: {str(e)}\n{traceback.format_exc()}")
        return jsonify({"error": "Internal server error"}), 500

@app.route('/api/users/<username>', methods=['PUT'])
@jwt_required()
def update_user(username):
    try:
        current_user = get_jwt_identity()
        user = users_collection.find_one({"username": current_user})
        if not user or user.get("role") != "admin":
            return jsonify({"error": "Unauthorized"}), 403
        
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400
        
        update_fields = {}
        if "role" in data:
            update_fields["role"] = data["role"]
        if "servers" in data:
            update_fields["servers"] = data["servers"]
        if "password" in data:
            update_fields["password"] = data["password"]  # Plaintext for PoC
        
        result = users_collection.update_one(
            {"username": username},
            {"$set": update_fields}
        )
        if result.matched_count == 0:
            return jsonify({"error": "User not found"}), 404
        
        app.logger.info(f"Updated user: {username} by admin: {current_user}")
        return jsonify({"message": "User updated successfully"})
    except Exception as e:
        app.logger.error(f"Update user error: {str(e)}\n{traceback.format_exc()}")
        return jsonify({"error": "Internal server error"}), 500

@app.route('/api/users/<username>', methods=['DELETE'])
@jwt_required()
def delete_user(username):
    try:
        current_user = get_jwt_identity()
        user = users_collection.find_one({"username": current_user})
        if not user or user.get("role") != "admin":
            return jsonify({"error": "Unauthorized"}), 403
        
        if username == current_user:
            return jsonify({"error": "Cannot delete yourself"}), 400
        
        result = users_collection.delete_one({"username": username})
        if result.deleted_count == 0:
            return jsonify({"error": "User not found"}), 404
        
        app.logger.info(f"Deleted user: {username} by admin: {current_user}")
        return jsonify({"message": "User deleted successfully"})
    except Exception as e:
        app.logger.error(f"Delete user error: {str(e)}\n{traceback.format_exc()}")
        return jsonify({"error": "Internal server error"}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)  # debug=False for PoC stability
