<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Actions;

use App\Modules\Messaging\Models\Conversation;
use App\Shared\Audit\RecordAudit;
use Illuminate\Support\Facades\DB;

/**
 * Restriction d'une contrepartie : elle lit, n'ouvre ni ne répond (ADR 0033, décision 5). Elle vaut pour tous les fils de la fiche
 * dans l'organisation ; `$jours` null la lève. Rejouable.
 */
final readonly class RestrictCounterpart
{
    public const int JOURS_MAX = 30;

    public function __construct(private RecordAudit $audit) {}

    public function handle(Conversation $fil, ?int $jours, ?string $motif): Conversation
    {
        return DB::transaction(function () use ($fil, $jours, $motif): Conversation {
            $jusque = $jours === null ? null : now()->addDays(min($jours, self::JOURS_MAX));

            Conversation::query()
                ->where('kind', $fil->kind)
                ->where('party_id', $fil->party_id)
                ->lockForUpdate()
                ->get()
                ->each(fn (Conversation $conversation): bool => $conversation->forceFill([
                    'counterpart_muted_until' => $jusque,
                    'counterpart_muted_reason' => $jours === null ? null : $motif,
                ])->save());

            $this->audit->handle($jours === null ? 'messaging.conversation.unmuted' : 'messaging.conversation.muted', subject: $fil, metadata: [
                'kind' => $fil->kind->value,
                'until' => $jusque?->toIso8601String(),
            ]);

            return $fil->refresh();
        });
    }
}
