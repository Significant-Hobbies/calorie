export function AccessibleChartTable({
  caption,
  columns,
  rows,
}: {
  caption: string;
  columns: string[];
  rows: Array<Array<string | number>>;
}) {
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <thead>
        <tr>
          {columns.map((column) => (
            <th key={column} scope="col">
              {column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, rowIndex) => (
          <tr key={`${row[0]}-${rowIndex}`}>
            {row.map((value, columnIndex) =>
              columnIndex === 0 ? (
                <th key={columnIndex} scope="row">
                  {value}
                </th>
              ) : (
                <td key={columnIndex}>{value}</td>
              )
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
