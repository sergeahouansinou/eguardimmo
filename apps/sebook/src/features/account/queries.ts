"use client";

import { useToast } from "@/components/roost/Toast";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRedirectToSignIn } from "@/features/favorites/queries";
import { useSession } from "@/features/session/SessionProvider";
import { formatMinor } from "@/lib/money";
import { describeFailure } from "@/marketplace/errors";
import { sebookKeys } from "@/marketplace/keys";
import { cancelBooking, fetchBookingsPage } from "@/marketplace/requests";

export function useBookings() {
  const { client } = useSession();
  return useInfiniteQuery({
    queryKey: sebookKeys.bookings,
    queryFn: ({ pageParam }) => fetchBookingsPage(client, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
  });
}

export function useCancelBooking(onDone: () => void) {
  const { client } = useSession();
  const queryClient = useQueryClient();
  const toast = useToast();
  const redirect = useRedirectToSignIn();
  return useMutation({
    mutationFn: (id: string) => cancelBooking(client, id),
    onSuccess: (booking) => {
      void queryClient.invalidateQueries({ queryKey: sebookKeys.bookings });
      toast.show({
        tone: "success",
        title: "Réservation annulée",
        description: booking.refund_minor === null ? undefined : `Montant remboursable selon les conditions : ${formatMinor(booking.refund_minor, booking.currency)}.`,
      });
      onDone();
    },
    onError: (error) => {
      const failure = describeFailure(error);
      if (failure.kind === "unauthenticated") {
        redirect();
        return;
      }
      toast.show({ tone: "danger", title: "Annulation impossible", description: failure.message });
      if (failure.kind === "notFound") void queryClient.invalidateQueries({ queryKey: sebookKeys.bookings });
      onDone();
    },
  });
}
