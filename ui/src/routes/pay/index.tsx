import { useParams } from "react-router-dom";

export default function PayPage() {
  const { id } = useParams();
  return <div>id is: {id}</div>;
}
