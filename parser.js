import { generatePlantUML } from "./generateplantuml";

const INVALID_TYPES = ['package' , 'return'];

export function transformJavaClassesToUml(javaFiles: string[]): string{
  const classesData: ClassData[] = [];
  for(const javaFile of javaFiles) {
    const classData = extractDataFromJavaFile(javaFile);
    classesData.push(classData)    
  }
  return generatePlantUML(classesData);
}

type ClassMethod = {
  name: string
  returnType: string
  parameters: string[]
}
type ClassProperty = {
  name: string
  type: string
} 

type ClassData = {
  properties: ClassProperty[]
  methods: ClassMethod[]
  name: string,
  implements: string[],
  extends?: string,
}

function extractDataFromJavaFile(javaFile: string): ClassData {
  return {
    name: getClassNameFromJavaFile(javaFile),
    extends: getExtendsFromJavaFile(javaFile),
    implements: getImplementsFromJavaFile(javaFile),
    methods: getClassMethodsFromJavaFile(javaFile),
    properties: getClassPropertiesFromJavaFile(javaFile),
  }
}

function getClassNameFromJavaFile(javaFile: string): string {
  const classRegex = /(enum|class)\s+([^\s{]+)/g;
  let classMatch = classRegex.exec(javaFile);
  if (classMatch) {
    return classMatch[2];
  }
  throw new Error("Function not implemented.");
}

function getClassMethodsFromJavaFile(javaFile: string): ClassMethod[] {
  const methodRegex = /(?:(public|protected|private|static|final)\s+)*([\w<>\[\]]+)\s+(\w+)\s*\(([^)]*)\)/g;
  const methods: ClassMethod[] = [];
  let methodMatch: any;
  while ((methodMatch = methodRegex.exec(javaFile)) !== null) {
    const returnType = methodMatch[2];
    if(returnType === 'new') {
      continue
    }

    const name = methodMatch[3];
    const parameters = methodMatch[4].trim();

    const parsedParams = parameters
    ? parameters.split(',').map((param: string) => {
        const [type, paramName] = param.trim().split(/\s+/);
        return { name: paramName, type };
    })
    : [];

    methods.push({
        name,
        parameters: parsedParams,
        returnType
    });
  }

  return methods;
}

function getClassPropertiesFromJavaFile(javaFile: string): ClassProperty[] {
  const propertyPattern = /\b(private|protected|public)?\s*(static\s+)?([a-zA-Z_$][a-zA-Z_$0-9]*)\s+([a-zA-Z_$][a-zA-Z_$0-9]*)\s*(=[^;]*)?;/g;
  const properties: ClassProperty[] = [];
  let propertyMatch: any; 

  while ((propertyMatch = propertyPattern.exec(javaFile)) !== null) {
    delete propertyMatch.input
    const type = propertyMatch[3];
    const isInvalidType = INVALID_TYPES.includes(type);
    if (isInvalidType){
      continue
    }
    const name = propertyMatch[4];
    properties.push({ name, type });
  }
  
  return properties;
}

function getExtendsFromJavaFile(javaFile: string): string | undefined {
  const extendsRegex = /extends\s+([^\s{]+)/g;
  let extendsMatch = extendsRegex.exec(javaFile);

  if(extendsMatch) {
    return extendsMatch[1];
  }
}

function getImplementsFromJavaFile(javaFile: string): string[] {
  const implementsRegex = /implements\s+([^\s{]+)/g;
  let implementsMatch = implementsRegex.exec(javaFile);
  if(implementsMatch) {
    return [implementsMatch[1]];
      
  }

  return [];
}
