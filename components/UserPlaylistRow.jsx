// Memo'd row: shared by the library preview (max 5) and the full
// View-All page. Parent state churn must NOT re-render every row —
// props are primitives + stable callbacks only.
// NOTE: named UserPlaylistRow (not PlaylistRow) — components/PlaylistRow.js
// is the pre-existing horizontal carousel (props items/title); an identical
// basename with a different extension resolves ambiguously in Metro and
// mounted the wrong component (title undefined -> .includes crash).
import { memo } from "react";
import { View } from "react-native";
import { IconButton, Surface, Text, TouchableRipple, ActivityIndicator } from "react-native-paper";

const UserPlaylistRow = memo(function UserPlaylistRow({ item, isDeleting, onPress, onMenuPress }) {
  const name = item?.name ?? "Untitled playlist";
  const songCount = item?.songCount ?? 0;
  return (
    <Surface
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        padding: 12,
        paddingVertical: 16,
        marginBottom: 8,
        borderRadius: 12,
        elevation: 1,
        opacity: isDeleting ? 0.5 : 1,
      }}
    >
      <TouchableRipple style={{ flex: 1 }} onPress={() => onPress?.(item?.id)}>
        <View>
          <Text variant="titleMedium" numberOfLines={1}>{name}</Text>
          <Text variant="bodyMedium" style={{ color: "#888" }}>
            {songCount} songs
          </Text>
        </View>
      </TouchableRipple>

      {isDeleting ? (
        <ActivityIndicator size="small" style={{ margin: 8 }} />
      ) : (
        <IconButton
          icon="dots-vertical"
          size={24}
          onPress={() => onMenuPress?.(item)}
          style={{ margin: 0 }}
        />
      )}
    </Surface>
  );
});

export default UserPlaylistRow;
