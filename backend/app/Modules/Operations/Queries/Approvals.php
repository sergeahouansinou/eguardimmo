<?php

declare(strict_types=1);

namespace App\Modules\Operations\Queries;

use App\Modules\Identity\Enums\OperatorRole;
use App\Modules\Operations\Enums\ApprovableAction;
use App\Modules\Operations\Enums\ApprovalStatus;
use App\Modules\Operations\Enums\ErrorCode;
use App\Modules\Operations\Models\OperatorApproval;
use Illuminate\Contracts\Pagination\CursorPaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Pagination\Cursor;
use Illuminate\Support\Str;

/**
 * Les demandes vues par un opérateur : seulement celles des actions que son rôle peut demander ou valider.
 */
final class Approvals
{
    public function hasLivePending(string $action, string $subjectId): bool
    {
        return OperatorApproval::query()->where('action', $action)->where('subject_id', $subjectId)
            ->where('status', ApprovalStatus::Pending)->where('expires_at', '>', now())->exists();
    }

    /**
     * @param  list<OperatorRole>  $roles
     * @return CursorPaginator<int, OperatorApproval>
     */
    public function page(array $roles, ?ApprovalStatus $statut, ?ApprovableAction $action, ?string $demandeurId, ?string $curseur, int $parPage): CursorPaginator
    {
        return $this->visibles($roles)
            ->when($statut !== null, fn (Builder $q): Builder => $q->where('status', $statut))
            ->when($action !== null, fn (Builder $q): Builder => $q->where('action', $action))
            ->when($demandeurId !== null, fn (Builder $q): Builder => $q->where('requested_by_user_id', $demandeurId))
            ->with(['requester', 'decider'])
            ->orderByDesc('id')
            ->cursorPaginate($parPage, cursor: $curseur === null ? null : Cursor::fromEncoded($curseur));
    }

    /**
     * @param  list<OperatorRole>  $roles
     */
    public function find(array $roles, string $id): OperatorApproval
    {
        $demande = Str::isUuid($id) ? $this->visibles($roles)->with(['requester', 'decider'])->find(strtolower($id)) : null;

        return $demande ?? throw ErrorCode::ApprovalNotFound->problem();
    }

    /**
     * @param  list<OperatorRole>  $roles
     */
    public function pendingCount(array $roles): int
    {
        return $this->visibles($roles)->where('status', ApprovalStatus::Pending)->where('expires_at', '>', now())->count();
    }

    /**
     * @param  list<OperatorRole>  $roles
     * @return Builder<OperatorApproval>
     */
    private function visibles(array $roles): Builder
    {
        return OperatorApproval::query()->whereIn('action', array_map(fn (ApprovableAction $a): string => $a->value, ApprovableAction::visibleTo($roles)));
    }
}
