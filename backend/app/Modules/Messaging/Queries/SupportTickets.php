<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Queries;

use App\Modules\Messaging\Data\TicketFilters;
use App\Modules\Messaging\Enums\TicketPriority;
use App\Modules\Messaging\Enums\TicketStatus;
use App\Modules\Messaging\Models\SupportTicket;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;

final class SupportTickets
{
    /**
     * @return LengthAwarePaginator<int, SupportTicket>
     */
    public function list(TicketFilters $filtres): LengthAwarePaginator
    {
        $requete = $this->filtrer($filtres);

        if ($filtres->status !== null) {
            $requete->where('status', $filtres->status);
        }

        return $requete
            ->with(['requester', 'assignee'])
            ->withCount('messages')
            ->orderByRaw("case priority when 'high' then 0 when 'normal' then 1 else 2 end")
            ->orderByDesc('last_activity_at')
            ->orderByDesc('id')
            ->paginate($filtres->perPage, page: $filtres->page);
    }

    /**
     * @return array{open: int, waiting: int, resolved: int, all: int}
     */
    public function counts(TicketFilters $filtres): array
    {
        $parStatut = $this->filtrer($filtres)->toBase()->selectRaw('status, count(*) as total')->groupBy('status')->pluck('total', 'status');
        $compte = fn (TicketStatus $statut): int => (int) ($parStatut[$statut->value] ?? 0);

        return [
            'open' => $compte(TicketStatus::Open),
            'waiting' => $compte(TicketStatus::Waiting),
            'resolved' => $compte(TicketStatus::Resolved),
            'all' => (int) $parStatut->sum(),
        ];
    }

    /**
     * @return array{open: int, open_high: int, waiting: int, resolved_30d: int, first_response_minutes: int|null}
     */
    public function stats(): array
    {
        $delais = SupportTicket::query()
            ->whereNotNull('first_response_at')
            ->where('created_at', '>=', now()->subDays(30))
            ->get(['created_at', 'first_response_at'])
            ->map(fn (SupportTicket $ticket): float => $ticket->created_at->diffInMinutes($ticket->first_response_at));

        return [
            'open' => SupportTicket::query()->where('status', TicketStatus::Open)->count(),
            'open_high' => SupportTicket::query()->where('status', TicketStatus::Open)->where('priority', TicketPriority::High)->count(),
            'waiting' => SupportTicket::query()->where('status', TicketStatus::Waiting)->count(),
            'resolved_30d' => SupportTicket::query()->where('status', TicketStatus::Resolved)->where('resolved_at', '>=', now()->subDays(30))->count(),
            'first_response_minutes' => $delais->isEmpty() ? null : (int) round((float) $delais->median()),
        ];
    }

    /**
     * @return Builder<SupportTicket>
     */
    private function filtrer(TicketFilters $filtres): Builder
    {
        $requete = SupportTicket::query();

        if ($filtres->priority !== null) {
            $requete->where('priority', $filtres->priority);
        }

        if ($filtres->unassigned) {
            $requete->whereNull('assignee_user_id');
        } elseif ($filtres->assigneeUserId !== null) {
            $requete->where('assignee_user_id', $filtres->assigneeUserId);
        }

        if ($filtres->search !== null) {
            $motif = '%'.addcslashes($filtres->search, '%_\\').'%';
            $requete->where(function (Builder $q) use ($motif): void {
                $q->where('reference', 'like', $motif)
                    ->orWhere('subject', 'like', $motif)
                    ->orWhere('organization_name', 'like', $motif)
                    ->orWhereHas('requester', fn (Builder $u) => $u->where('name', 'like', $motif));
            });
        }

        return $requete;
    }
}
