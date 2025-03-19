import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Table, Form, ProgressBar, Card, Container, Row, Col, Badge, Button, FormControl, Modal, Dropdown } from 'react-bootstrap';
import { Pie } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';
import UserManagement from './UserManagement';

ChartJS.register(ArcElement, Tooltip, Legend);

function App() {
    const [servers, setServers] = useState([]);
    const [filteredServers, setFilteredServers] = useState([]);
    const [selectedServer, setSelectedServer] = useState(null);
    const [statusFilter, setStatusFilter] = useState('All');
    const [searchTerm, setSearchTerm] = useState('');
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [role, setRole] = useState('');
    const [showSignup, setShowSignup] = useState(false);
    const [newUser, setNewUser] = useState({ username: '', password: '', role: 'viewer', servers: [] });
    const [allServers, setAllServers] = useState([]);
    const [newServerSearch, setNewServerSearch] = useState('');

    const calculateCompliancePercentage = (tests) => {
        if (!tests || !Array.isArray(tests) || tests.length === 0) return 0;
        const okCount = tests.filter(test => test.status === 'OK').length;
        return (okCount / tests.length) * 100;
    };

    // Deduplicate servers by hostname and ip_address, keeping the latest by timestamp
    const deduplicateServers = (serverList) => {
        const uniqueServers = {};
        serverList.forEach(server => {
            const key = `${server.hostname}-${server.ip_address}`;
            if (!uniqueServers[key] || new Date(server.timestamp) > new Date(uniqueServers[key].timestamp)) {
                uniqueServers[key] = {
                    ...server,
                    compliance_percentage: calculateCompliancePercentage(server.scan_data?.tests),
                    hostname: server.hostname || 'Unknown',
                    ip_address: server.ip_address || 'N/A'
                };
            }
        });
        return Object.values(uniqueServers);
    };

    const fetchServers = useCallback(async (token) => {
        try {
            const response = await axios.get('/api/servers', {
                headers: { Authorization: `Bearer ${token}` }
            });
            console.log("Fetched servers:", response.data);
            const enrichedServers = deduplicateServers(response.data);
            console.log("Deduplicated servers:", enrichedServers);
            setServers(enrichedServers);
            setFilteredServers(enrichedServers);
        } catch (err) {
            const errorMsg = err.response ? err.response.data.error : err.message;
            console.error("Fetch servers error:", errorMsg);
            if (err.response?.status === 401) {
                setError('Session expired or invalid token');
                setIsAuthenticated(false);
                localStorage.removeItem('token');
                localStorage.removeItem('username');
                localStorage.removeItem('role');
            } else {
                setError(`Failed to fetch servers: ${errorMsg}`);
            }
        }
    }, []);

    const fetchAllServers = useCallback(async (token) => {
        try {
            const response = await axios.get('/api/all_servers', {
                headers: { Authorization: `Bearer ${token}` }
            });
            console.log("Fetched all servers:", response.data);
            const enrichedServers = deduplicateServers(response.data);
            console.log("Deduplicated all servers:", enrichedServers);
            setAllServers(enrichedServers);
        } catch (err) {
            const errorMsg = err.response ? err.response.data.error : err.message;
            console.error("Fetch all servers error:", errorMsg);
            setError(`Failed to fetch all servers: ${errorMsg}`);
        }
    }, []);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token) {
            setIsAuthenticated(true);
            const storedUsername = localStorage.getItem('username');
            const storedRole = localStorage.getItem('role');
            setUsername(storedUsername || '');
            setRole(storedRole || '');
            fetchServers(token);
            if (storedRole === 'admin') {
                fetchAllServers(token);
            }
        }
    }, [fetchServers, fetchAllServers]);

    const handleLogin = async (e) => {
        e.preventDefault();
        try {
            const response = await axios.post('/api/login', { username, password });
            const { access_token, username: loggedInUsername, role } = response.data;
            localStorage.setItem('token', access_token);
            localStorage.setItem('username', loggedInUsername);
            localStorage.setItem('role', role);
            setIsAuthenticated(true);
            setUsername(loggedInUsername);
            setRole(role);
            setError('');
            fetchServers(access_token);
            if (role === 'admin') fetchAllServers(access_token);
        } catch (err) {
            setError('Invalid credentials');
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('username');
        localStorage.removeItem('role');
        setIsAuthenticated(false);
        setServers([]);
        setFilteredServers([]);
        setSelectedServer(null);
        setUsername('');
        setRole('');
        setAllServers([]);
    };

    const handleSignup = async (e) => {
        e.preventDefault();
        try {
            const token = localStorage.getItem('token');
            const response = await axios.post('/api/signup', {
                ...newUser,
                servers: newUser.servers
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            alert(response.data.message);
            setShowSignup(false);
            setNewUser({ username: '', password: '', role: 'viewer', servers: [] });
            setNewServerSearch('');
        } catch (err) {
            alert(err.response?.data?.error || 'Signup failed');
        }
    };

    useEffect(() => {
        if (isAuthenticated) {
            const filtered = servers.filter(server => {
                const hostname = server.hostname || '';
                const ipAddress = server.ip_address || '';
                return (
                    hostname.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    ipAddress.toLowerCase().includes(searchTerm.toLowerCase())
                );
            });
            setFilteredServers(filtered);
        }
    }, [searchTerm, servers, isAuthenticated]);

    const filteredTests = selectedServer
        ? statusFilter === 'All'
            ? selectedServer.scan_data.tests
            : selectedServer.scan_data.tests.filter(test => test.status === statusFilter)
        : [];

    const getPieChartData = (tests) => {
        if (!tests) return null;
        const okCount = tests.filter(test => test.status === 'OK').length;
        const warningCount = tests.filter(test => test.status === 'WARNING').length;
        const suggestionCount = tests.filter(test => test.status === 'SUGGESTION').length;
        return {
            labels: ['OK', 'WARNING', 'SUGGESTION'],
            datasets: [{
                data: [okCount, warningCount, suggestionCount],
                backgroundColor: ['#28a745', '#dc3545', '#ffc107'],
                hoverBackgroundColor: ['#218838', '#c82333', '#e0a800'],
            }]
        };
    };

    const pieChartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { position: 'top' },
            tooltip: {
                callbacks: {
                    label: function(context) {
                        const label = context.label || '';
                        const value = context.raw || 0;
                        const total = context.dataset.data.reduce((a, b) => a + b, 0);
                        const percentage = ((value / total) * 100).toFixed(1);
                        return `${label}: ${value} (${percentage}%)`;
                    }
                }
            }
        }
    };

    const getStatusCounts = (tests) => {
        if (!tests) return { ok: 0, warning: 0, suggestion: 0 };
        return {
            ok: tests.filter(test => test.status === 'OK').length,
            warning: tests.filter(test => test.status === 'WARNING').length,
            suggestion: tests.filter(test => test.status === 'SUGGESTION').length
        };
    };

    const getComplianceVariant = (percentage) => {
        if (percentage >= 80) return 'success';
        if (percentage >= 50) return 'warning';
        return 'danger';
    };

    const filteredNewServers = allServers.filter(server => {
        const hostname = server.hostname || '';
        const ipAddress = server.ip_address || '';
        return (
            hostname.toLowerCase().includes(newServerSearch.toLowerCase()) ||
            ipAddress.toLowerCase().includes(newServerSearch.toLowerCase())
        );
    });

    const handleSelectAllNewServers = (e) => {
        if (e.target.checked) {
            setNewUser({ ...newUser, servers: filteredNewServers.map(server => server.server_id) });
        } else {
            setNewUser({ ...newUser, servers: [] });
        }
    };

    if (!isAuthenticated) {
        return (
            <Container className="mt-5">
                <Row className="justify-content-md-center">
                    <Col md={4}>
                        <Card>
                            <Card.Body>
                                <h2 className="text-center mb-4">Login</h2>
                                {error && <p className="text-danger text-center">{error}</p>}
                                <Form onSubmit={handleLogin}>
                                    <Form.Group className="mb-3" controlId="username">
                                        <Form.Label>Username</Form.Label>
                                        <FormControl
                                            type="text"
                                            value={username}
                                            onChange={(e) => setUsername(e.target.value)}
                                            placeholder="Enter username"
                                        />
                                    </Form.Group>
                                    <Form.Group className="mb-3" controlId="password">
                                        <Form.Label>Password</Form.Label>
                                        <FormControl
                                            type="password"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            placeholder="Enter password"
                                        />
                                    </Form.Group>
                                    <Button variant="primary" type="submit" className="w-100">
                                        Login
                                    </Button>
                                </Form>
                            </Card.Body>
                        </Card>
                    </Col>
                </Row>
            </Container>
        );
    }

    return (
        <Container className="mt-4">
            <Row className="mb-3 align-items-center">
                <Col>
                    <h1
                        style={{
                            color: '#fff',
                            fontWeight: '700',
                            fontSize: '2.5rem',
                            background: '#1B263B',
                            padding: '10px 20px',
                            borderRadius: '12px',
                            boxShadow: '0 4px 12px rgba(27, 38, 59, 0.3)',
                            display: 'inline-block',
                            whiteSpace: 'nowrap',
                            transition: 'transform 0.2s ease-in-out',
                        }}
                        onMouseEnter={(e) => e.target.style.transform = 'scale(1.05)'}
                        onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
                    >
                        Server Compliance Dashboard
                    </h1>
                </Col>
                <Col className="text-end">
                    <Dropdown align="end">
                        <Dropdown.Toggle
                            variant="link"
                            id="dropdown-username"
                            style={{
                                textDecoration: 'none',
                                color: '#007bff',
                                fontWeight: 'bold',
                                fontSize: '1.1em',
                                padding: '5px 10px',
                                borderRadius: '5px',
                                backgroundColor: '#e9ecef',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                            }}
                        >
                            {username}
                        </Dropdown.Toggle>
                        <Dropdown.Menu>
                            {role === 'admin' && (
                                <>
                                    <Dropdown.Item onClick={() => setShowSignup(true)}>
                                        Create User
                                    </Dropdown.Item>
                                    <Dropdown.Item
                                        href="/user-management"
                                        target="_blank"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            window.open('/user-management', '_blank');
                                        }}
                                    >
                                        User Management
                                    </Dropdown.Item>
                                </>
                            )}
                            <Dropdown.Item onClick={handleLogout}>
                                Logout
                            </Dropdown.Item>
                        </Dropdown.Menu>
                    </Dropdown>
                </Col>
            </Row>

            <Form.Group className="mb-4" controlId="searchBar">
                <Form.Label>Search by Hostname or IP Address</Form.Label>
                <Form.Control
                    type="text"
                    placeholder="Enter hostname or IP address"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="shadow-sm"
                />
            </Form.Group>

            <Row>
                {filteredServers.length > 0 ? (
                    filteredServers.map(server => (
                        <Row key={server.server_id} className="mb-4">
                            <Col md={4}>
                                <Card className="shadow-sm h-100" onClick={() => setSelectedServer(server)} style={{ cursor: 'pointer' }}>
                                    <Card.Body>
                                        <Card.Title>{server.hostname} ({server.ip_address})</Card.Title>
                                        <Card.Text>
                                            <strong>Last Scan:</strong> {''}
                                            {new Date(server.timestamp).toLocaleString('en-US', {
                                                year: 'numeric',
                                                month: 'numeric',
                                                day: 'numeric',
                                                hour: 'numeric',
                                                minute: 'numeric',
                                                second: 'numeric',
                                                hour12: true,
                                                timeZone: 'Asia/Kolkata'
                                            })}
                                        </Card.Text>
                                        <Card.Text>
                                            <strong>Compliance:</strong>
                                            <ProgressBar
                                                now={server.compliance_percentage}
                                                label={`${server.compliance_percentage ? server.compliance_percentage.toFixed(1) : '0.0'}%`}
                                                variant={getComplianceVariant(server.compliance_percentage || 0)}
                                            />
                                        </Card.Text>
                                        <Card.Text>
                                            <strong>CPU Usage:</strong>
                                            <ProgressBar
                                                now={server.metrics?.cpu_usage || 0}
                                                label={`${server.metrics?.cpu_usage || 'N/A'}%`}
                                                variant={(server.metrics?.cpu_usage || 0) > 80 ? "danger" : "success"}
                                            />
                                        </Card.Text>
                                        <Card.Text>
                                            <strong>Memory Usage:</strong>
                                            <ProgressBar
                                                now={server.metrics?.memory_usage || 0}
                                                label={`${server.metrics?.memory_usage || 'N/A'}%`}
                                                variant={(server.metrics?.memory_usage || 0) > 80 ? "danger" : "success"}
                                            />
                                        </Card.Text>
                                        <Card.Text>
                                            <strong>Disk Usage:</strong>
                                            <ProgressBar
                                                now={server.metrics?.disk_usage?.use_percent || 0}
                                                label={`${server.metrics?.disk_usage?.use_percent || 'N/A'}%`}
                                                variant={(server.metrics?.disk_usage?.use_percent || 0) > 80 ? "danger" : "success"}
                                            />
                                            <small>
                                                Used: {server.metrics?.disk_usage?.used || 'N/A'} / {server.metrics?.disk_usage?.size || 'N/A'},
                                                Avail: {server.metrics?.disk_usage?.avail || 'N/A'}
                                            </small>
                                        </Card.Text>
                                    </Card.Body>
                                </Card>
                            </Col>
                            <Col md={4}>
                                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Pie data={getPieChartData(server.scan_data?.tests)} options={pieChartOptions} height={200} />
                                </div>
                            </Col>
                            <Col md={4}>
                                <div className="status-counts h-100 d-flex flex-column justify-content-center">
                                    <h5 className="text-center mb-3">Status Counts</h5>
                                    {(() => {
                                        const counts = getStatusCounts(server.scan_data?.tests);
                                        return (
                                            <>
                                                <p><Badge bg="success" className="me-2">OK</Badge> <span className="count-value">{counts.ok}</span></p>
                                                <p><Badge bg="danger" className="me-2">WARNING</Badge> <span className="count-value">{counts.warning}</span></p>
                                                <p><Badge bg="warning" className="me-2">SUGGESTION</Badge> <span className="count-value">{counts.suggestion}</span></p>
                                            </>
                                        );
                                    })()}
                                </div>
                            </Col>
                        </Row>
                    ))
                ) : (
                    <Col><p className="text-center">No servers assigned to you</p></Col>
                )}
            </Row>

            {selectedServer && (
                <div className="mt-5">
                    <h2>{selectedServer.hostname} - Details</h2>
                    <Row>
                        <Col md={12}>
                            <Form.Group className="mb-3" controlId="statusFilter">
                                <Form.Label>Filter by Status</Form.Label>
                                <Form.Control
                                    as="select"
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value)}
                                    className="shadow-sm"
                                >
                                    <option value="All">All</option>
                                    <option value="OK">OK</option>
                                    <option value="WARNING">WARNING</option>
                                    <option value="SUGGESTION">SUGGESTION</option>
                                </Form.Control>
                            </Form.Group>
                            <Table striped bordered hover className="shadow-sm">
                                <thead>
                                    <tr>
                                        <th>Test ID</th>
                                        <th>Status</th>
                                        <th>Description</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredTests.map(test => (
                                        <tr key={test.test_id}>
                                            <td>{test.test_id}</td>
                                            <td>{test.status}</td>
                                            <td>{test.description || "N/A"}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </Table>
                        </Col>
                    </Row>
                </div>
            )}

            <Modal show={showSignup} onHide={() => setShowSignup(false)}>
                <Modal.Header closeButton>
                    <Modal.Title>Create New User</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Form onSubmit={handleSignup}>
                        <Form.Group className="mb-3" controlId="newUsername">
                            <Form.Label>Username</Form.Label>
                            <FormControl
                                type="text"
                                value={newUser.username}
                                onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                                placeholder="Enter username"
                            />
                        </Form.Group>
                        <Form.Group className="mb-3" controlId="newPassword">
                            <Form.Label>Password</Form.Label>
                            <FormControl
                                type="password"
                                value={newUser.password}
                                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                                placeholder="Enter password"
                            />
                        </Form.Group>
                        <Form.Group className="mb-3" controlId="newRole">
                            <Form.Label>Role</Form.Label>
                            <FormControl
                                as="select"
                                value={newUser.role}
                                onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                            >
                                <option value="viewer">Viewer</option>
                                <option value="admin">Admin</option>
                            </FormControl>
                        </Form.Group>
                        <Form.Group className="mb-3" controlId="newServers">
                            <Form.Label>Servers</Form.Label>
                            <FormControl
                                type="text"
                                placeholder="Search by hostname or IP address"
                                value={newServerSearch}
                                onChange={(e) => setNewServerSearch(e.target.value)}
                                className="mb-2"
                            />
                            <Form.Check
                                type="checkbox"
                                label="Select All Servers"
                                checked={newUser.servers.length === filteredNewServers.length && filteredNewServers.length > 0}
                                onChange={handleSelectAllNewServers}
                                className="mb-2"
                            />
                            <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                                {filteredNewServers.map(server => (
                                    <Form.Check
                                        key={server.server_id}
                                        type="checkbox"
                                        label={`${server.hostname} (${server.ip_address})`}
                                        checked={newUser.servers.includes(server.server_id)}
                                        onChange={(e) => {
                                            const updatedServers = e.target.checked
                                                ? [...newUser.servers, server.server_id]
                                                : newUser.servers.filter(s => s !== server.server_id);
                                            setNewUser({ ...newUser, servers: updatedServers });
                                        }}
                                    />
                                ))}
                            </div>
                        </Form.Group>
                        <Button variant="primary" type="submit">
                            Create User
                        </Button>
                    </Form>
                </Modal.Body>
            </Modal>
        </Container>
    );
}

function AppWrapper() {
    return (
        <Router>
            <Routes>
                <Route path="/" element={<App />} />
                <Route path="/user-management" element={<UserManagement />} />
            </Routes>
        </Router>
    );
}

export default AppWrapper;
