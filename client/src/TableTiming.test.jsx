import { act, render, screen } from "@testing-library/react";
import { Elapsed, useTableTiming } from "./TableTiming";

function Opening({waiting=true,ready=false,deadline}) {
  const attempt=useTableTiming("test",waiting,ready);
  return waiting ? <Elapsed attempt={attempt} deadline={deadline}/> : null;
}

test("estimates using completed openings and keeps the request deadline separate",()=>{
  jest.useFakeTimers();
  try {
    sessionStorage.clear();
    const {rerender}=render(<Opening/>);
    act(()=>jest.advanceTimersByTime(9000));
    rerender(<Opening waiting={false}/>);
    for (let i=0;i<2;i++) {
      rerender(<Opening/>);
      act(()=>jest.advanceTimersByTime(4000));
      rerender(<Opening waiting={false} ready/>);
    }
    rerender(<Opening deadline={Date.now()+20000}/>);
    act(()=>jest.advanceTimersByTime(1000));
    expect(screen.getByRole("timer")).toHaveTextContent("1s elapsed · About 3s left based on recent tables · Request timeout in 19s");
    act(()=>jest.advanceTimersByTime(4000));
    expect(screen.getByRole("timer")).toHaveTextContent("Taking longer than usual");
  } finally { sessionStorage.clear(); jest.useRealTimers(); }
});
