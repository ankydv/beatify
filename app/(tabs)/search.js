import React, { useState } from "react";
import SearchBox from "@/components/searchBox";
import { SafeAreaView } from "react-native-safe-area-context";
import axios from "axios";
import SearchResults from "@/components/searchResults";
const API_URL = process.env.EXPO_PUBLIC_API_URL;
const Search = () => {
  const [results, setResults] = useState([]);

  const onSubmit = (searchValue) => {
    fetchResults(searchValue);
  };

  const fetchResults = async (searchValue) => {
    try {
      const response = await axios.get(
        `${API_URL}/api/search/${encodeURIComponent(searchValue)}`
      );
      setResults(rearrangeResponse(response.data));
    } catch (error) {
      console.error("Error fetching search results:", error);
    }
  };
  const rearrangeResponse = (res) => {
    return res.reduce((acc, item) => {
      var { category, ...rest } = item;
      if (category === "Profiles") return acc;
      if (category == null) {
        const temp = item.resultType;
        category = temp.charAt(0).toUpperCase() + temp.slice(1) + "s";
      }
      const existingIndex = acc.findIndex(
        (group) => group.category === category
      );

      if (existingIndex !== -1) {
        acc[existingIndex].data.push(rest);
      } else {
        acc.push({ category, data: [rest] });
      }

      return acc;
    }, []);
  };
  return (
    <SafeAreaView>
      <SearchBox onSubmit={onSubmit} />
      <SearchResults results={results} />
    </SafeAreaView>
  );
};

export default Search;
