let reg = new Array(64).fill(0)
let mem = new Array(4000000000)
let labels = new Array()
// let programWasCompiledSuccessfully = false
// let compilerErrors = []
let compiledInstructions = []
let programWasCompiledSuccessfully = false
let ic = 0
let delayInBetweenInstructions = 1000
let compilerErrors = []
let usedLabels = new Array()

function setDelay(delay) {
    if (Number.isNaN(delay) || delay < 0) {
        delayInBetweenInstructions = 1000
        document.getElementById("delay_input").value = 1000
    } else {
        delayInBetweenInstructions = delay
    }
}

function numberIsPressed(e) { // return true if a number key or backspace is pressed, prevent otherwise
    var charValue = String.fromCharCode(e.keyCode);
    if ((isNaN(charValue)) && (e.which != 8)) { // backspace code is 8
        e.preventDefault();
    }
    return true;
}

function compileProgram(program) {
    // if compile button pressed during the execution of a program, halt the execution
    endOfProgram = true

    // initialize environment
    compiledInstructions = []
    // reset registers, memory, labels, and ic if any data is present from a previous compilation
    reg = new Array(64).fill(0)
    mem = new Array(4000000000)
    ic = 0
    labels = new Array()
    usedLabels = new Array()
    // update shown values
    updateRegisters()
    clearMemory()

    programWasCompiledSuccessfully = false
    compilerErrors = []

    // change all the program to lowercase and split program's code into lines
    lines = program.toLowerCase().split(/\r?\n/)
    let i = 0
    for (const line of lines) {
        if (validateInstruction(line, i++))
            break
    }

    document.getElementById("compilerMsgs").innerHTML = ''

    if (usedLabels.length) {
        for (const label of usedLabels) {
            compilerErrors.push("Label " + label + " is referenced in a jump instruction but doesn't exist inside the program")
        }
    }

    // flag successful compilation if compilerErrors' length is zero
    if (programWasCompiledSuccessfully = !(compilerErrors.length)) {
        document.getElementById("compilerMsgs").innerHTML = "<div class='alert alert-success'>Compilation was successful</div>"
    }

    for (const error of compilerErrors) { // print any errors
        document.getElementById("compilerMsgs").innerHTML += '<div class="alert alert-danger" role="alert">Compiler error: ' + error + '</div>'
    }

    // empty compiledInstructions if compilation wasn't successful
    if (compilerErrors.length)
        compiledInstructions = []
}

async function runProgram() {
    if (!programWasCompiledSuccessfully)
        return

    // split program's code into lines
    // lines = program.split(/\r?\n/)
    endOfProgram = false

    while (!endOfProgram) {
        updateRegisters()
        decodeInstruction(compiledInstructions[ic], ic)
        await new Promise(r => setTimeout(r, delayInBetweenInstructions)) // sleep

    }
}

function validateInstruction(line, instructionIndex) { // check syntax and register labels
    //splitLine = line.split(/\s|,\s*/)
    splitLine = line.split(/\s|(?<=,)/)

    if(splitLine[0][0] == ';') // comment
        return 0

    let rega, regb, regc, rbase, rindex, label, rret // declaration of parameter variables

    // check for labels
    if (splitLine[0].slice(-1) == ":") {
        labels[splitLine[0].slice(0, -1)] = instructionIndex // add couple [label, index of corresponding instruction] to labels array

        // if this label is used by an instruction, remove it from usedLabels to confirm it does exist in the program
        if (usedLabels.indexOf(splitLine[0].slice(0, -1)) != -1)
            usedLabels.splice(usedLabels.indexOf(splitLine[0].slice(0, -1)), 1)

        splitLine.shift() // ignore labels when executing instructions
    }

    const operation = splitLine[0] // get the operation code

    if (operation == "end") {
        compiledInstructions.push("end")
        return
    }
    if (isALOp(operation)) {
        if (!validParams(operation, splitLine[1], splitLine[2], splitLine[3], splitLine[4], instructionIndex)) { // an extra token (splitLine[4] in this case) is passed to the validating instruction to test if there is additional unwanted text after the operands
            // exception
            return 1
        } else {
            // get rega, regb, regc params
            if (typeof (splitLine[1]) != "undefined")
                rega = splitLine[1].replace(/r/g, '').replace(/,/g, '')
            // only read second and third parameters if present
            if (typeof (splitLine[2]) != "undefined")
                regb = splitLine[2].replace(/r/g, '').replace(/,/g, '')
            if (typeof (splitLine[3]) != "undefined")
                regc = splitLine[3].replace(/r/g, '')
            compiledInstructions.push([operation, rega, regb, regc])
        }
    } else if (isConditionalJump(operation)) {
        if (!validParams(operation, splitLine[1], splitLine[2], splitLine[3], splitLine[4], instructionIndex)) {
            // exception
            return 1
        } else {
            // get rega, regb, label params
            rega = splitLine[1].replace(/r/g, '').replace(/,/g, '')
            regb = splitLine[2].replace(/r/g, '').replace(/,/g, '')
            label = splitLine[3]
            compiledInstructions.push([operation, rega, regb, label])
        }
    } else if (isUnconditionalJump(operation)) {
        // get label param for goto
        if (!validParams(operation, splitLine[1], splitLine[2], undefined, undefined, instructionIndex)) {
            // exception
            return 1
        } else {
            label = splitLine[1]
            compiledInstructions.push([operation, label])
        }
    } else if (isMemoryOp(operation)) {
        // get rbase, rindex, rc params
        if (!validParams(operation, splitLine[1], splitLine[2], splitLine[3], splitLine[4], instructionIndex)) {
            // exception
            return 1
        } else {
            rbase = splitLine[1].replace(/r/g, '').replace(/,/g, '')
            rindex = splitLine[2].replace(/r/g, '').replace(/,/g, '')
            regc = splitLine[3].replace(/r/g, '')
            compiledInstructions.push([operation, rbase, rindex, regc])
        }
    } else { // invalid operation
        compilerErrors.push("Invalid operation at line " + instructionIndex + ": " + operation)
        return 1
    }
    return 0
}

function decodeInstruction(instruction, instructionIndex) {
    if (typeof (instruction) == "undefined") {
        endOfProgram = true
        ic = 0
        return
    }
    let isImmediateInstruction = false
    switch (instruction[0]) {
        case "addi":
        case "subi":
        case "muli":
        case "divi":
        case "movi":
            isImmediateInstruction = true
        case "add":
        case "sub":
        case "mul":
        case "div":
        case "inc":
        case "dec":
        case "clear":
        case "mov":
            executeALOperation(instruction, isImmediateInstruction)
            break
        case "storei":
        case "loadi":
            isImmediateInstruction = true
        case "store":
        case "load":
            executeMemoryOperation(instruction, isImmediateInstruction)
            break
        case "if<0":
        case "if<=0":
        case "if>0":
        case "if>=0":
        case "if=0":
        case "if!=0":
            isImmediateInstruction = true
        case "if<":
        case "if<=":
        case "if>":
        case "if>=":
        case "if=":
        case "if!=":
            evaluateConditionalJump(instruction, isImmediateInstruction)
            break
        case "goto":
        case "call":
            executeUnconditionalJump(instruction)
            break
        case "end":
            endOfProgram = true
            ic = 0
            break
    }
}

evaluateConditionalJump = function (instruction, isImmediate) {
    condition = instruction[0].slice(2).replace(/0/g, '').replace(/^=/g, '==') // strip off "0" if present as it's handled by the isImmediate parameter, and change "=" to "==" for expression evalutaion
    rega = instruction[1]
    if (isImmediate) {
        paramb = 0
        label = instruction[2]
    } else {
        paramb = reg[instruction[2]]
        label = instruction[3]
    }
    if (eval(reg[rega] + condition + paramb))
        ic = labels[label]
    else
        ic++
}

executeALOperation = function (instruction, isImmediate) {
    operation = instruction[0]
    rega = instruction[1]
    regb = instruction[2] // if the instruction is an immediate one (e.g. addi), this parameter is to be treated as a constant rather than a register number
    regc = instruction[3]

    if (isImmediate)
        operation = operation.slice(0, -1) // cut out the 'i' at the end of immediate operations as the instruction has already been registered as immediate, and process it normally

    if (operation == "clear")
        reg[rega] = 0
    else if (operation == "inc")
        reg[rega]++
    else if (operation == "dec")
        reg[rega]--
    else if (operation == "mov") {
        if (isImmediate) {
            reg[regb] = rega
        } else {
            reg[regb] = reg[rega]
        }
    }
    else {
        let operator
        switch (operation) {
            case "add":
                operator = '+'
                break
            case "sub":
                operator = '-'
                break
            case "mul":
                operator = '*'
                break
            case "div":
                operator = '/'
                break
        }

        if (isImmediate) // if the instruction is an immediate operation (e.g. addi)
            result = eval(reg[rega] + operator + regb)
        else
            result = eval(reg[rega] + operator + reg[regb])

        reg[regc] = result
    }
    ic++
}

executeMemoryOperation = function (instruction, isImmediate) {
    operation = instruction[0]
    if (isImmediate)
        operation = operation.slice(0, -1) // cut out the 'i' at the end of immediate operations as the instruction has already been registered as immediate, and process it normally

    rbase = instruction[1]
    rindex = instruction[2]
    regc = instruction[3]


    if (isImmediate)
        offset = parseInt(rindex)
    else
        offset = parseInt(reg[rindex])

    const address = parseInt(reg[rbase]) + offset

    if (operation == "load") {
        if (typeof (mem[address]) == "undefined") { // simulate random data in uninitialized memory locations
            mem[address] = Math.floor(Math.random() * (2 ** 32))
        }
        reg[regc] = mem[address]
    } else if (operation == "store") {
        mem[address] = reg[regc]
        updateMemory(address)
    }
    ic++
}

executeUnconditionalJump = function (instruction) {
    label = instruction[1]
    ic = labels[label]
}

function validParams() {
    return true
}

function isALOp(operation) {
    return ["add", "addi", "subi", "divi", "muli", "sub", "div", "mul", "inc", "dec", "clear", "mov", "movi"].includes(operation)
}

function isMemoryOp(operation) {
    return ["store", "load", "storei", "loadi"].includes(operation)
}

function isConditionalJump(operation) {
    return ["if>", "if>=", "if>0", "if>=0", "if<", "if<=", "if<0", "if<=0", "if=", "if!=", "if=0", "if!=0"].includes(operation)
}

function isUnconditionalJump(operation) {
    return ["goto"].includes(operation)
}

createRegisterList = function () {
    const regdiv = document.getElementById("regs")
    const reglist = document.getElementById("reglist")
    let i = 0

    for (const r of reg) {
        const newli = document.createElement("li")
        newli.setAttribute("id", "reg" + i)
        newli.setAttribute("class", "contains_zero")
        newli.innerHTML = "R" + i + ": <span id='reg" + i++ + "_val'>" + r + "</span>"
        reglist.appendChild(newli)
    }
}

updateRegisters = function () {
    let i = 0

    document.getElementById("instruction").innerHTML = "IC: " + ic
    for (const r of reg) {
        this_reg = document.getElementById("reg" + i)
        this_reg_val = document.getElementById("reg" + i + "_val")
        this_reg_val.innerHTML = r
        if (!r) {
            this_reg.classList.add("contains_zero")
            toggleZeroRegisters()
        } else {
            if (this_reg.classList.contains("contains_zero")) {
                this_reg.classList.remove("contains_zero")
                $("#reg" + i).css("display", "block");
            }
        }
        i++
    }
}

updateMemory = function (address) {
    const memlist = document.getElementById("memlist")
    if (document.getElementById("loc" + address) != null) {
        document.getElementById("loc" + address).innerHTML = address + ": " + mem[address]
    } else {
        const newli = document.createElement("li")
        newli.setAttribute("id", "loc" + address)
        newli.innerHTML = address + ": " + mem[address]
        memlist.appendChild(newli)
    }
}

toggleZeroRegisters = function () {
    if (document.getElementById("toggleZeroRegs").checked) {
        $(".contains_zero").css("display", "none");
    } else {
        $(".contains_zero").css("display", "block");
    }
}

clearMemory = function () {
    document.getElementById("memlist").innerHTML = ""
}

validParams = function (operation, param1, param2, param3, extra, lineNumber) {
    if (operation.slice(-1) == "i" || operation.slice(-1) == "0") {
        isImmediate = true
        operation = operation.slice(0, -1) // trim trailing 'i' or '0' for immediate operations
    } else {
        isImmediate = false
    }
    if (["add", "sub", "mul", "div", "load", "store"].includes(operation)) { // expects 3 register or 1 register, 1 immediate parameter, 1 register if immediate operation
        if (!isImmediate) {
            if(!isValidRegister(param1, true, lineNumber) || !isValidRegister(param2, true, lineNumber) || !isValidRegister(param3, false, lineNumber))
                return false
        }

        if(isImmediate) {
            if(!isValidRegister(param1, true, lineNumber) || !isValidConstant(param2, lineNumber) || !isValidRegister(param3, false, lineNumber))
                return false
        }

        if(typeof(extra) != "undefined" && extra[0] != ";") {
            compilerErrors.push(unexpectedAdditionalText(extra, lineNumber))
            return false
        }

    } else if (["inc", "dec", "clear"].includes(operation)) { // expects 1 register
        if(isValidRegister(param1, false, lineNumber)) {
            if(typeof(param2) != "undefined" && param2[0] != ";") {
                compilerErrors.push(unexpectedAdditionalText(param2, lineNumber))
                return false
            }
        } else
            return false
    } else if (operation == "mov") { // expects 2 registers or 1 immediate value and 1 register if immediate operation
        if(!isImmediate)
            if(!isValidRegister(param1, true, lineNumber) || !isValidRegister(param2, false, lineNumber))
                return false

        if(isImmediate)
            if(!isValidConstant(param1, lineNumber) || !isValidRegister(param2, false, lineNumber)) 
                return false

        if(typeof(param3) != "undefined" && param3[0] != ";") {
            compilerErrors.push(unexpectedAdditionalText(param3, lineNumber))
            return false
        }
    } else if (operation == "goto") { // expects 1 label
        if (isValidLabel(param1)) {
            if (typeof (labels[param1]) == "undefined" && usedLabels.indexOf(param1) == -1) // add label to usedLabel so it can be later verified whether any instruction has in fact this label
                usedLabels.push(param1)
            if(typeof(param2) != "undefined" && param2[0] != ";") {
                compilerErrors.push(unexpectedAdditionalText(param2, lineNumber))
                return false
            }
        } else {
            compilerErrors.push("Invalid label " + param1 + " at line " + lineNumber)
            return false
        }
    } else if (["if>", "if>=", "if<", "if<=", "if=", "if!="].includes(operation)) { // expects 2 register and 1 label or 1 register and 1 label if immediate operation
        if (isImmediate)
            label = param2
        else
            label = param3

        if (isValidLabel(label)) {
            if (typeof (labels[label]) == "undefined" && usedLabels.indexOf(label) == -1) // add label to usedLabel so it can be later verified whether any instruction has in fact this label
                usedLabels.push(label)
        } else {
            compilerErrors.push("Invalid label " + label + " at line " + lineNumber)
            return false
        }
        if (!isValidRegister(param1, true, lineNumber))
            return false
        if (!isImmediate && !isValidRegister(param2, true, lineNumber))
            return false
        if(isImmediate) {
            if(typeof(param3) != "undefined" && param3[0] != ";") {
                compilerErrors.push(unexpectedAdditionalText(param3, lineNumber))
                return false
            }
        } else {
            if(typeof(extra) != "undefined" && extra[0] != ";") {
                compilerErrors.push(unexpectedAdditionalText(extra, lineNumber))
                return false
            }
        }
    }
    return true
}

isValidRegister = function (str, expectedComma, lineNumber) {
    if(typeof(str) == "undefined" || !str) {
        compilerErrors.push("Missing operand at line " + lineNumber + ". Expected a register")
        return false
    }
    if (!/^r[0-9][0-9]?,?$/.test(str)) {
        compilerErrors.push("Invalid operand " + str + ". Expected a register at line " + lineNumber)
        return false
    }
    if (parseInt(str.slice(1)) > 63) { // parseInt(str.slice(1)) < 0 || parseInt(str.slice(1)) > 63 || isNaN(parseInt(str.slice(1)))
        compilerErrors.push("Invalid register " + str.slice(1) + " at line " + lineNumber)
        return false
    }
    if ((str.slice(-1) == ',') != expectedComma) {
        if (expectedComma) {
            str = "Expected"
        } else {
            str = "Unexpected"
        }
        str += " comma at line " + lineNumber
        compilerErrors.push(str)
        return false
    }
    return true
}

isValidConstant = function (str, lineNumber) {
    if(typeof(str) == "undefined" || !str) {
        compilerErrors.push("Missing operand at line " + lineNumber + ". Expected a numerical constant")
        return false
    }
    if (str.slice(0, -1) == parseInt(str.slice(0, -1)))
        return true
    compilerErrors.push("Invalid operand " + str + " at line " + lineNumber + ". Expected a numerical constant")
    return false
}

isValidLabel = function (str) {
    return /^[a-zA-Z0-9._]+$/.test(str)
}

unexpectedAdditionalText = function(str, lineNumber) {
    return `Unexpected parameter ${str} at line ` + lineNumber + `. If it was meant as a comment, add <strong>;</strong> before the text.`

}