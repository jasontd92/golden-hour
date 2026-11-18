export function parseCsvRows(text: string): string[][] {
	const rows: string[][] = [];
	let row: string[] = [];
	let field = '';
	let state: 'start' | 'plain' | 'quoted' | 'quoteInQuoted' = 'start';
	const endField = () => {
		row.push(field);
		field = '';
		state = 'start';
	};
	const endRow = () => {
		if (state !== 'start' || row.length > 0) endField();
		if (row.length > 0) rows.push(row);
		row = [];
	};
	for (const char of text.replace(/\r\n?/g, '\n')) {
		if (state === 'quoted') {
			if (char === '"') state = 'quoteInQuoted';
			else field += char;
		} else if (char === ',') endField();
		else if (char === '\n') endRow();
		else if (char === '"' && state === 'start') state = 'quoted';
		else if (char === '"' && state === 'quoteInQuoted') {
			field += char;
			state = 'quoted';
		} else {
			field += char;
			state = 'plain';
		}
	}
	if (state === 'quoted') throw new Error('csv ends inside a quoted field');
	endRow();
	return rows;
}

export function parseCsvRecords(text: string): Record<string, string>[] {
	const [header, ...rows] = parseCsvRows(text);
	if (!header) return [];
	return rows.map((row, index) => {
		if (row.length !== header.length) {
			throw new Error(`csv row ${index + 2} has ${row.length} fields; the header has ${header.length}`);
		}
		return Object.fromEntries(header.map((name, column) => [name, row[column] ?? '']));
	});
}
