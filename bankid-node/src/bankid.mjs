async function post({ apiClient, path, data, onResponse }) {
  const response = await apiClient.post(path, data, {
    validateStatus: (status) => status < 500,
  });
  if (onResponse) {
    await onResponse({
      request: {
        method: "POST",
        path,
        data,
      },
      response: {
        status: response.status,
        headers: response.headers,
        data: response.data,
      },
    });
  }
  return response;
}

export async function collect({ apiClient, orderRef, onResponse }) {
  const path = "/rp/v5.1/collect";
  const data = {
    orderRef,
  };
  const response = await post({
    apiClient,
    path,
    data,
    onResponse,
  });

  return { ...response.data, httpStatus: response.status };
}

export async function auth(
  options = {
    apiClient: undefined,
    endUserIp: undefined,
    personalNumber: undefined,
    text: undefined,
    onResponse: undefined,
  }
) {
  return startFlow({
    path: "/rp/v5.1/auth",
    ...options,
  });
}

export async function sign(
  options = {
    apiClient: undefined,
    endUserIp: undefined,
    personalNumber: undefined,
    text: undefined,
    onResponse: undefined,
  }
) {
  return startFlow({
    path: "/rp/v5.1/sign",
    ...options,
  });
}

async function startFlow({
  path,
  apiClient,
  endUserIp,
  personalNumber,
  text,
  onResponse,
}) {
  let userVisibleData;
  let userVisibleDataFormat;
  if (text) {
    userVisibleData = Buffer.from(text).toString("base64");
    userVisibleDataFormat = "simpleMarkdownV1";
  }

  const data = {
    endUserIp,
    personalNumber,
    userVisibleData,
    userVisibleDataFormat,
  };

  // convert empty strings to undefined
  Object.keys(data).forEach((key) => {
    if (data[key] === "") {
      data[key] = undefined;
    }
  });

  const response = await post({ apiClient, path, data, onResponse });
  return { ...response.data, httpStatus: response.status };
}
