function getGitHubApiUrl(gitHubUrl) {
    // This function will convert a regular GitHub repository URL to its API endpoint.
    const repoPath = gitHubUrl.replace(/^https:\/\/github.com\//, "");
    return `https://api.github.com/repos/${repoPath}/contents/`;
}

async function fetchJavaFiles() {
    // Clear the output before starting a new process
    document.getElementById('output').innerHTML = '';  
    const gitHubUrl = document.getElementById('repoUrl').value;
    const apiUrl = getGitHubApiUrl(gitHubUrl); // Get the correct API URL
    
    try {
        
        await fetchAndParseFiles(apiUrl, '');
        
        
        finalizeUML();
    } catch (error) {
        console.error("Error processing files: ", error);
    }
}

async function fetchAndParseFiles(baseUrl, path) {
    const fileListUrl = `${baseUrl}${path}`;
    const response = await fetch(fileListUrl);

    if (!response.ok) {
        throw new Error(`Failed to fetch ${fileListUrl}: ${response.statusText}`);
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
let relationsSet = new Set();
const processedClasses = new Set();
let FinalPlantUML = "@startuml\n";
let classesDictionary = {};

function parseJavaFile(filePath, content) {
    content = content.replace(/^package\s+[^\s;]+;/gm, '');
    content = content.replace(/\/\/.*$/gm, '');
    content = content.replace(/\/\*[\s\S]*?\*\//g, '');

    const classRegex = /class\s+([^\s{]+)/g;
    const enumRegex = /enum\s+([^\s{]+)/g;
    const constructorRegex = /public\s+([A-Z]\w*)\s*\([^)]*\)\s*\{([\s\S]*?)\}/g;
    const assignmentRegex = /(\w+)\s*=\s*new\s+([A-Z]\w*)\(/g;
    const methodRegex = /(public|protected|private|static|\s)\s+[\w<>\[\]]+\s+(\w+)\s*\(([^)]*)\)/g;
    const attributeRegex = /^\s*(public|protected|private)?\s+([\w<>\[\]]+)\s+(\w+)\s*;/gm;
    const inheritanceRegex = /class\s+([^\s{]+)\s+extends\s+([^\s{]+)/;
    const interfaceRegex = /class\s+([^\s{]+)\s+implements\s+([^\s{]+)/;

    let plantUML = "";
    let relations = "";  

    let classMatch = classRegex.exec(content);
    let enumMatch = enumRegex.exec(content);

    if (enumMatch) {
        let enumName = enumMatch[1];

        if (!processedClasses.has(enumName)) {
            processedClasses.add(enumName);  
            plantUML += `enum ${enumName} {\n`;

            const enumValuesRegex = /(\w+),?/g;
            let enumValuesSection = content.slice(content.indexOf(enumName) + enumName.length);
            let valueMatch;
            while ((valueMatch = enumValuesRegex.exec(enumValuesSection)) !== null) {
                plantUML += `    ${valueMatch[1]}\n`;
            }
            plantUML += `}\n`;
        }
    }

    if (classMatch) {
        let className = classMatch[1];

        if (!processedClasses.has(className)) {
            processedClasses.add(className);  
            plantUML += `class ${className} {\n`;

            if (!classesDictionary[className]) {
                classesDictionary[className] = { attributes: []};  
            }

            let methodPosition = content.search(methodRegex);
            let attributesSection = content.slice(0, methodPosition);

            let attributeMatch;
            while ((attributeMatch = attributeRegex.exec(attributesSection)) !== null) {
                let visibility = attributeMatch[1];
                let attributeType = attributeMatch[2];
                let attributeName = attributeMatch[3];
                let visibilitySymbol = getVisibilitySymbol(visibility);

                classesDictionary[className].attributes.push({
                    name: attributeName,
                    type: attributeType,
                    visibility: getVisibilitySymbol(visibility)
                });

                if (attributeType.includes("ArrayList") || attributeType.includes("LinkedList")) {
                    let listType = attributeType.match(/(?:ArrayList|LinkedList)<([^>]+)>/)[1];  
                    plantUML += `    ${visibilitySymbol}${attributeName}: ${listType} [*]\n`;  
                } else {
                    plantUML += `    ${visibilitySymbol}${attributeName}: ${attributeType}\n`;
                    if (isClass(attributeType)) {
                        addRelation(className, attributeType); 
                    }
                }
            }

            let constructorMatch;
            while ((constructorMatch = constructorRegex.exec(content)) !== null) {
                let constructorName = constructorMatch[1];  
                let constructorBody = constructorMatch[2];  
                
                let assignmentMatch;
                while ((assignmentMatch = assignmentRegex.exec(constructorBody)) !== null) {
                    let attributeName = assignmentMatch[1]; 
                    let classType = assignmentMatch[2];      
                    
                    if(classType !== "ArrayList" && classType !== "LinkedList"){
                        addCompositionRelation(className,classType);
                    }

                    
                }
            }

            // Reset the regex index for method search within the class
            let methodMatch;
            while ((methodMatch = methodRegex.exec(content)) !== null) {
                let visibility = methodMatch[1];
                let methodName = methodMatch[2];
                let methodParams = methodMatch[3];

                let visibilitySymbol = getVisibilitySymbol(visibility);
                if(methodName === className){
                    plantUML += `    +${methodName}(${methodParams})\n`;
                }
                else{
                    plantUML += `    ${visibilitySymbol}${methodName}(${methodParams})\n`;
                }
                
            }
            plantUML += `}\n`;

            let inheritanceMatch = inheritanceRegex.exec(content);
            if (inheritanceMatch) {
                let parentClass = inheritanceMatch[2];
                relations += `${parentClass} <|-- ${className}\n`;  
            }

            let interfaceMatch = interfaceRegex.exec(content);
            if (interfaceMatch) {
                let interfaces = interfaceMatch[2].split(",");
                for (let interfaceName of interfaces) {
                    relations += `${className} ..|> ${interfaceName.trim()}\n`;  
                }
            }
        }
    }

    FinalPlantUML += plantUML + relations;
}

function getVisibilitySymbol(visibility) {
    switch (visibility) {
        case 'public':
            return '+';
        case 'private':
            return '-';
        case 'protected':
            return '#';
        default:
            return ''; 
    }
}

function addRelation(classA, classB) {
    const relationAtoB = `${classA} --> ${classB}`;
    const relationBtoA = `${classB} --> ${classA}`;
    
    if (relationsSet.has(relationBtoA)) {
        relationsSet.delete(relationBtoA);
        relationsSet.add(`${classA} -- ${classB}`);
    } else {
        relationsSet.add(relationAtoB);
    }
}

function addCompositionRelation(classA, classB) {
    const relationAtoB = `${classA} --> ${classB}`;
    if (relationsSet.has(relationAtoB)) {
        relationsSet.delete(relationAtoB);
    }
    relationsSet.add(`${classA} *-- ${classB}`);
}

function generateRelations() {
    let relations = '';
    for (let relation of relationsSet) {
        relations += relation + '\n';
    }
    return relations;
}
                    
function generateArrayListRelations(classesDictionary){
    for (let className in classesDictionary) {
        let attributes = classesDictionary[className].attributes;

        for (let attribute of attributes) {
            if (attribute.type.includes("ArrayList") || attribute.type.includes("LinkedList")) {
                let listType = attribute.type.match(/<(.*?)>/)[1]; 

                let relationAtoB = `${className} --> "0..*" ${listType}`;
                let relationBtoA = `${listType} --> ${className}`;
                let relationBtoAMultiplicity = `${listType} "0..*" -- "0..*" ${className}`;
                let relationBtoAMultiplicityVer = `${listType} -- "0..*" ${className}`;
                let relationSimple = `${className} -- "0..*" ${listType}`;

                if (relationsSet.has(relationBtoA)) {
                    relationsSet.delete(relationBtoA); 
                    relationsSet.add(relationSimple);  
                } 
                else if (relationsSet.has(relationBtoAMultiplicityVer)) {
                    relationsSet.delete(relationBtoAMultiplicity); 
                    relationsSet.add(relationBtoAMultiplicity);    
                } 
                else {
                    relationsSet.add(relationAtoB);
                }
            }
        }
    }
}

function finalizeUML() {
    generateArrayListRelations(classesDictionary);
    const relations = generateRelations();
    FinalPlantUML += "\n" + relations;
    FinalPlantUML += "\n@enduml"; 
    let output = document.getElementById('output');
    output.innerHTML = `<pre>${FinalPlantUML}</pre>`;
}

function isClass(type) {
    const knownTypes = ['int', 'double', 'float', 'char', 'boolean', 'String', 'void'];  
    return !knownTypes.includes(type);  
}

