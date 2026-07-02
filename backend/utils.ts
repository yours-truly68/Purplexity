export function slugify(text:string) {
    const base = text.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g, "").slice(0, 60) || "chat";
    return `${base}-${crypto.randomUUID().slice(0, 8)}`
}

export function sourcesBlock(results:{url: string}[]) {
    return `\n<SOURCES>\n${JSON.stringify(results.map(r =>({url: r.url})))}\n</SOURCES>`
}