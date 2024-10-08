const http = require('http');
const fs = require('fs').promises;
const path = require('path');

const PORT = 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'shopping-list.json');

async function initializeDataStore() {
    try {
        await fs.mkdir(DATA_DIR, { recursive: true });
        try {
            await fs.access(DATA_FILE);
        } catch {
            await fs.writeFile(DATA_FILE, JSON.stringify([], null, 2));
        }
    } catch (error) {
        console.error('Error initializing data store:', error);
        process.exit(1);
    }
}

async function readShoppingList() {
    try {
        const data = await fs.readFile(DATA_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading shopping list:', error);
        return [];
    }
}

async function writeShoppingList(list) {
    try {
        await fs.writeFile(DATA_FILE, JSON.stringify(list, null, 2));
    } catch (error) {
        console.error('Error writing shopping list:', error);
        throw error;
    }
}

function setCORSHeaders(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

async function handleRequest(req, res) {
    setCORSHeaders(res);

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    try {
        const url = new URL(req.url, `http://${req.headers.host}`);
        const pathSegments = url.pathname.split('/').filter(Boolean);

        if (pathSegments[0] !== 'shopping-list') {
            throw new Error('Invalid endpoint');
        }

        let body;
        if (req.method !== 'GET') {
            body = await getRequestBody(req);
        }

        switch (req.method) {
            case 'GET':
                await handleGet(res);
                break;
            case 'POST':
                await handlePost(body, res);
                break;
            case 'PUT':
                await handlePut(pathSegments[1], body, res);
                break;
            case 'DELETE':
                await handleDelete(pathSegments[1], res);
                break;
            default:
                throw new Error(`Method ${req.method} not allowed`);
        }
    } catch (error) {
        sendResponse(res, 400, { error: error.message });
    }
}

async function handleGet(res) {
    const list = await readShoppingList();
    sendResponse(res, 200, list);
}

async function handlePost(body, res) {
    if (!body.item || !body.quantity) {
        throw new Error('Item and quantity are required');
    }

    const list = await readShoppingList();
    const newItem = {
        id: Date.now().toString(),
        item: body.item,
        quantity: body.quantity
    };
    
    list.push(newItem);
    await writeShoppingList(list);
    sendResponse(res, 201, newItem);
}

async function handlePut(id, body, res) {
    if (!id || !body.item || !body.quantity) {
        throw new Error('ID, item, and quantity are required');
    }

    const list = await readShoppingList();
    const index = list.findIndex(item => item.id === id);
    
    if (index === -1) {
        throw new Error('Item not found');
    }

    list[index] = { ...list[index], ...body };
    await writeShoppingList(list);
    sendResponse(res, 200, list[index]);
}

async function handleDelete(id, res) {
    if (!id) {
        throw new Error('ID is required');
    }

    const list = await readShoppingList();
    const filteredList = list.filter(item => item.id !== id);
    
    if (filteredList.length === list.length) {
        throw new Error('Item not found');
    }

    await writeShoppingList(filteredList);
    sendResponse(res, 204);
}

function sendResponse(res, statusCode, data = null) {
    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
    };
    
    res.writeHead(statusCode, headers);
    res.end(data ? JSON.stringify(data) : '');
}

async function getRequestBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                resolve(JSON.parse(body));
            } catch {
                reject(new Error('Invalid JSON'));
            }
        });
    });
}

async function startServer() {
    await initializeDataStore();
    const server = http.createServer(handleRequest);
    server.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}

startServer().catch(console.error);