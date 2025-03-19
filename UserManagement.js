import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Table, Form, Button, Container, Modal, FormControl } from 'react-bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';

function UserManagement() {
    const [users, setUsers] = useState([]);
    const [allServers, setAllServers] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [showEdit, setShowEdit] = useState(false);
    const [editUser, setEditUser] = useState({ username: '', role: '', servers: [] });
    const [editServerSearch, setEditServerSearch] = useState('');
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('role');
    const currentUsername = localStorage.getItem('username');

    const fetchUsers = useCallback(async () => {
        try {
            const response = await axios.get('/api/users', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setUsers(response.data);
        } catch (err) {
            console.error("Fetch users error:", err.response ? err.response.data : err.message);
        }
    }, [token]);

    const fetchAllServers = useCallback(async () => {
        try {
            const response = await axios.get('/api/all_servers', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setAllServers(response.data);
        } catch (err) {
            console.error("Fetch all servers error:", err.response ? err.response.data : err.message);
        }
    }, [token]);

    useEffect(() => {
        if (!token || role !== 'admin') {
            window.location.href = '/';
        } else {
            fetchUsers();
            fetchAllServers();
        }
    }, [token, role, fetchUsers, fetchAllServers]);

    const handleEditUser = async (e) => {
        e.preventDefault();
        try {
            const response = await axios.put(`/api/users/${editUser.username}`, {
                role: editUser.role,
                servers: editUser.servers
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            alert(response.data.message);
            setShowEdit(false);
            setEditServerSearch('');
            fetchUsers();
        } catch (err) {
            alert(err.response?.data?.error || 'Edit failed');
        }
    };

    const handleDeleteUser = async (usernameToDelete) => {
        if (window.confirm(`Are you sure you want to delete ${usernameToDelete}?`)) {
            try {
                const response = await axios.delete(`/api/users/${usernameToDelete}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                alert(response.data.message);
                fetchUsers();
            } catch (err) {
                alert(err.response?.data?.error || 'Delete failed');
            }
        }
    };

    const filteredUsers = users.filter(user =>
        user.username.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const filteredEditServers = allServers.filter(server =>
        server.hostname.toLowerCase().includes(editServerSearch.toLowerCase()) ||
        server.ip_address.toLowerCase().includes(editServerSearch.toLowerCase())
    );

    const handleSelectAllEditServers = (e) => {
        if (e.target.checked) {
            setEditUser({ ...editUser, servers: filteredEditServers.map(server => server.server_id) });
        } else {
            setEditUser({ ...editUser, servers: [] });
        }
    };

    return (
        <Container className="mt-4">
            <h1
                style={{
                    color: '#fff',
                    fontWeight: '700',
                    fontSize: '2.5rem',
                    background: 'linear-gradient(90deg, #007bff, #00b4db)',
                    padding: '10px 20px',
                    borderRadius: '12px',
                    boxShadow: '0 4px 12px rgba(0, 123, 255, 0.3)',
                    display: 'inline-block',
                    whiteSpace: 'nowrap',
                    transition: 'transform 0.2s ease-in-out',
                }}
                onMouseEnter={(e) => e.target.style.transform = 'scale(1.05)'}
                onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
            >
                User Management
            </h1>
            <Form.Group className="mb-4" controlId="userSearchBar">
                <Form.Label>Search Users</Form.Label>
                <Form.Control
                    type="text"
                    placeholder="Enter username"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="shadow-sm"
                />
            </Form.Group>

            <Table striped bordered hover className="shadow-sm">
                <thead style={{ backgroundColor: '#007bff', color: 'white' }}>
                    <tr>
                        <th>Username</th>
                        <th>Role</th>
                        <th>Servers</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {filteredUsers.map(user => (
                        <tr key={user._id}>
                            <td>{user.username}</td>
                            <td>{user.role}</td>
                            <td>{user.servers?.join(', ') || 'All'}</td>
                            <td>
                                <Button
                                    variant="warning"
                                    size="sm"
                                    onClick={() => setEditUser({ username: user.username, role: user.role, servers: user.servers || [] }) || setShowEdit(true)}
                                    style={{
                                        borderRadius: '20px',
                                        padding: '5px 15px',
                                        marginRight: '5px',
                                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                    }}
                                >
                                    Edit
                                </Button>
                                <Button
                                    variant="danger"
                                    size="sm"
                                    onClick={() => handleDeleteUser(user.username)}
                                    disabled={user.username === currentUsername}
                                    style={{
                                        borderRadius: '20px',
                                        padding: '5px 15px',
                                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                    }}
                                >
                                    Delete
                                </Button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </Table>

            <Modal show={showEdit} onHide={() => setShowEdit(false)}>
                <Modal.Header closeButton>
                    <Modal.Title>Edit User: {editUser.username}</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Form onSubmit={handleEditUser}>
                        <Form.Group className="mb-3" controlId="editRole">
                            <Form.Label>Role</Form.Label>
                            <FormControl
                                as="select"
                                value={editUser.role}
                                onChange={(e) => setEditUser({ ...editUser, role: e.target.value })}
                            >
                                <option value="viewer">Viewer</option>
                                <option value="admin">Admin</option>
                            </FormControl>
                        </Form.Group>
                        <Form.Group className="mb-3" controlId="editServers">
                            <Form.Label>Servers</Form.Label>
                            <FormControl
                                type="text"
                                placeholder="Search by hostname or IP address"
                                value={editServerSearch}
                                onChange={(e) => setEditServerSearch(e.target.value)}
                                className="mb-2"
                            />
                            <Form.Check
                                type="checkbox"
                                label="Select All Servers"
                                checked={editUser.servers.length === filteredEditServers.length && filteredEditServers.length > 0}
                                onChange={handleSelectAllEditServers}
                                className="mb-2"
                            />
                            <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                                {filteredEditServers.map(server => (
                                    <Form.Check
                                        key={server.server_id}
                                        type="checkbox"
                                        label={`${server.hostname} (${server.ip_address})`}
                                        checked={editUser.servers.includes(server.server_id)}
                                        onChange={(e) => {
                                            const updatedServers = e.target.checked
                                                ? [...editUser.servers, server.server_id]
                                                : editUser.servers.filter(s => s !== server.server_id);
                                            setEditUser({ ...editUser, servers: updatedServers });
                                        }}
                                    />
                                ))}
                            </div>
                        </Form.Group>
                        <Button variant="primary" type="submit">
                            Save Changes
                        </Button>
                    </Form>
                </Modal.Body>
            </Modal>
        </Container>
    );
}

export default UserManagement;
