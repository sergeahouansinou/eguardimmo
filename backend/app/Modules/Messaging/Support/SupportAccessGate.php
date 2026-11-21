<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Support;

use App\Modules\Messaging\Enums\ErrorCode;
use App\Modules\Messaging\Enums\SupportAccessKind;
use App\Modules\Messaging\Enums\SupportAccessScope;
use App\Modules\Messaging\Enums\SupportAccessStatus;
use App\Modules\Messaging\Enums\TicketStatus;
use App\Modules\Messaging\Events\SupportAccessUsed;
use App\Modules\Messaging\Models\SupportAccessGrant;
use App\Shared\Audit\PreciseTimestamp;
use App\Shared\Audit\RecordAudit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Un opérateur ne lit les données d'une organisation qu'avec un accès vivant pour (opérateur, organisation, périmètre) : actif, non échu,
 * demande de support non résolue. Évalué à chaque lecture, jamais déduit d'une tâche planifiée ; chaque lecture est journalisée sans contenu.
 */
final readonly class SupportAccessGate
{
    public function __construct(private RecordAudit $audit) {}

    public function live(string $operateurId, string $organisationId, SupportAccessScope $perimetre): ?SupportAccessGrant
    {
        return SupportAccessGrant::query()
            ->where('operator_user_id', $operateurId)
            ->where('organization_id', $organisationId)
            ->where('status', SupportAccessStatus::Active)
            ->where('expires_at', '>', now()->format(PreciseTimestamp::FORMAT))
            ->whereHas('ticket', fn ($t) => $t->where('status', '!=', TicketStatus::Resolved))
            ->orderByDesc('expires_at')
            ->get()
            ->first(fn (SupportAccessGrant $acces): bool => in_array($perimetre->value, $acces->scopes, true));
    }

    public function denied(string $operateurId, string $organisationId, SupportAccessScope $perimetre, Request $request): void
    {
        $this->audit->handle('console.support_access.denied', actorId: $operateurId, metadata: [
            'organization_id' => $organisationId,
            'scope' => $perimetre->value,
            'resource' => $request->path(),
        ]);
    }

    public function recordRead(SupportAccessGrant $acces, SupportAccessScope $perimetre, Request $request): void
    {
        DB::transaction(function () use ($acces, $perimetre, $request): void {
            $verrouille = SupportAccessGrant::query()->whereKey($acces->id)->lockForUpdate()->firstOrFail();

            if (! $verrouille->isLive()) {
                throw ErrorCode::SupportAccessRequired->problem();
            }

            $premiere = $verrouille->read_count === 0;
            $verrouille->increment('read_count');

            $this->audit->handle('console.support_access.read', subject: $verrouille, metadata: [
                'grant_id' => $verrouille->id,
                'scope' => $perimetre->value,
                'resource' => $request->path(),
                'method' => $request->method(),
            ]);

            if ($premiere && $verrouille->kind === SupportAccessKind::Consent && $verrouille->organization_id !== null) {
                SupportAccessUsed::dispatch($verrouille->organization_id, $verrouille->id);
            }
        });
    }
}
