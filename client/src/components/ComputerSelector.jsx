import { useEffect, useState } from 'react';

function ComputerSelector({ onSelect }) {
    const [computers, setComputers] = useState([]);

    useEffect(() => {
        fetch('/api/computers')
            .then(res => res.json())
            .then(data => {
                const withAll = ['Все хосты', ...data];
                setComputers(withAll);
            });
    }, []);

    return (
        <select onChange={(e) => onSelect(e.target.value)}>
            {computers.map((name, idx) => (
                <option key={idx} value={name}>{name}</option>
            ))}
        </select>
    );
}

export default ComputerSelector;