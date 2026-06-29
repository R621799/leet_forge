// randomProblem.js – selects a random problem from a list
export function getRandomProblem(problems) {
    if (!Array.isArray(problems) || problems.length === 0) {
        return null;
    }
    const randomIndex = Math.floor(Math.random() * problems.length);
    return problems[randomIndex];
}
