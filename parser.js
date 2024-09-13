function getGitHubApiUrl(gitHubUrl) {
    // This function will convert a regular GitHub repository URL to its API endpoint.
    console.log('GitHub URL:', gitHubUrl);
    const repoPath = gitHubUrl.replace(/^https:\/\/github.com\//, "");
    return `https://api.github.com/repos/${repoPath}/contents/`;
}

async function fetchJavaFiles() {
    // Clear the output before starting a new process
    document.getElementById('output').innerHTML = '';    
    const gitHubUrl = document.getElementById('repoUrl').value;
    const apiUrl = getGitHubApiUrl(gitHubUrl); // Get the correct API URL
    await fetchAndParseFiles(apiUrl, '');
}

async function fetchAndParseFiles(baseUrl, path) {
    const fileListUrl = `${baseUrl}${path}`;

    const response = await fetch(fileListUrl);
    if (!response.ok) {
        console.error('Failed to fetch:', response.statusText);
        return;
    }
    const entries = await response.json();

    for (let entry of entries) {
        if (entry.type === 'file' && entry.name.endsWith('.java')) {
            const fileResponse = await fetch(entry.download_url);
            const fileContent = await fileResponse.text();
            parseJavaFile(entry.path, fileContent);
        } else if (entry.type === 'dir') {
            await fetchAndParseFiles(baseUrl, `${entry.path}/`);
        }
    }
}


function parseJavaFile(filePath, content) {
    const classRegex = /class\s+([^\s{]+)/g;
    const methodRegex = /(public|protected|private|static|\s)\s+[\w<>\[\]]+\s+(\w+)\s*\(([^)]*)\)/g;

    let output = document.getElementById('output');
    output.innerHTML += `<h3>${filePath}</h3>`;

    let classMatch = classRegex.exec(content);
    if (classMatch) {
        let className = classMatch[1];
        output.innerHTML += `<p>Class: ${className}</p>`;
        output.innerHTML += `<ul>`;

        // Reset the regex index for method search within the class
        let methodMatch;
        while ((methodMatch = methodRegex.exec(content)) !== null) {
            let methodName = methodMatch[2];
            let methodParams = methodMatch[3];
            output.innerHTML += `<li>Method: ${methodName} - Parameters: ${methodParams}</li>`;
        }

        output.innerHTML += `</ul>`;
    }
}
