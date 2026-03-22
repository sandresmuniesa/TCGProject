import { render, screen } from "@testing-library/react";
import { Text } from "react-native";

import { AppProviders } from "@/providers/app-providers";

describe("AppProviders", () => {
  it("renders children correctly", () => {
    render(
      <AppProviders>
        <Text>smoke-test</Text>
      </AppProviders>
    );

    expect(screen.getByText("smoke-test")).toBeInTheDocument();
  });
});