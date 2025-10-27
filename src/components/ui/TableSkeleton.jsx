import Skeleton from "./Skeleton";

const TableSkeleton = ({ numberOfCols, numberOfRows, numberOfHiddenRows }) => {
  const Row = ({ hidden }) => (
    <tr>
      {[...Array(numberOfCols)].map((_, i) => (
        <td key={i}>
          {hidden ? (
            <div style={{ height: "30px", width: "100%" }} />
          ) : (
            <Skeleton
              style={{ height: "30px", width: "100%" }}
              className="rounded-3"
            />
          )}
        </td>
      ))}
    </tr>
  );
  return (
    <>
      {[...Array(numberOfRows)].map((_, i) => (
        <Row key={"row-" + i} />
      ))}
      {[...Array(numberOfHiddenRows)].map((_, i) => (
        <Row key={"hidden-" + i} hidden />
      ))}
    </>
  );
};

export default TableSkeleton;
