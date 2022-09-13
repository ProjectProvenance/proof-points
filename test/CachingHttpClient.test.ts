import { expect } from "chai";
import { CachingHttpClient } from "../src/index";
import FakeHttpClient from "./fixtures/FakeHttpClient";

describe("CachingHttpClient", () => {
  it("Can fetch", async () => {
    const url = "http://example.com/1";
    const expectedResponse = "123";
    const fakeHttpClient = new FakeHttpClient({
      [url]: expectedResponse,
    });
    const subject = new CachingHttpClient(fakeHttpClient);

    const actualResponse = await subject.fetch(url);

    expect(actualResponse).to.eq(expectedResponse);
  });

  it("Does cache", async () => {
    const url = "http://example.com/1";
    const expectedResponse = "123";
    const fakeHttpClient = new FakeHttpClient({
      [url]: expectedResponse,
    });
    const subject = new CachingHttpClient(fakeHttpClient);

    const firstActualResponse = await subject.fetch(url);
    const secondActualResponse = await subject.fetch(url);

    expect(firstActualResponse).to.eq(expectedResponse);
    expect(secondActualResponse).to.eq(expectedResponse);
    expect(fakeHttpClient.requestCount(url)).to.eq(1);
  });
});
