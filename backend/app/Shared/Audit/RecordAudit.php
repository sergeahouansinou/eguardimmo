<?php

declare(strict_types=1);

namespace App\Shared\Audit;

use App\Shared\Http\AssignRequestId;
use App\Shared\Tenancy\CurrentOrganization;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Routing\Route;
use Illuminate\Support\Str;
use RuntimeException;

final readonly class RecordAudit
{
    private const USER_AGENT_MAX = 255;

    public function __construct(
        private Request $request,
        private CurrentOrganization $organisation,
    ) {}

    /**
     * Sans auteur explicite, l'auteur est l'utilisateur authentifié de la requête.
     *
     * @param  array<string, mixed>  $metadata
     * @param  array<string, array{old: mixed, new: mixed}>|null  $changes
     */
    public function handle(
        string $action,
        ?string $actorId = null,
        array $metadata = [],
        ?Model $subject = null,
        ?array $changes = null,
    ): AuditLog {
        $route = $this->request->route();

        return AuditLog::query()->create([
            'occurred_at' => now(),
            'action' => $action,
            'actor_user_id' => $actorId ?? $this->auteurCourant(),
            'organization_id' => $this->organisation($subject),
            'subject_type' => $subject?->getMorphClass(),
            'subject_id' => $subject !== null ? (string) $subject->getKey() : null,
            'changes' => $changes,
            'metadata' => $metadata,
            'request_id' => $this->identifiantDeRequete(),
            'route' => $route instanceof Route ? $route->getName() : null,
            'ip' => $this->request->ip(),
            'user_agent' => Str::limit((string) $this->request->userAgent(), self::USER_AGENT_MAX, '') ?: null,
        ]);
    }

    public function fingerprint(string $email): string
    {
        $cle = config('audit.hmac_key');

        if (! is_string($cle) || $cle === '') {
            throw new RuntimeException('AUDIT_HMAC_KEY doit être renseignée.');
        }

        return hash_hmac('sha256', Str::lower(trim($email)), $cle);
    }

    private function auteurCourant(): ?string
    {
        $identifiant = $this->request->user()?->getAuthIdentifier();

        return is_string($identifiant) ? $identifiant : null;
    }

    private function organisation(?Model $subject): ?string
    {
        $attributs = $subject?->getAttributes() ?? [];

        if (is_string($attributs['organization_id'] ?? null)) {
            return $attributs['organization_id'];
        }

        return $this->organisation->has() ? $this->organisation->id() : null;
    }

    private function identifiantDeRequete(): ?string
    {
        $identifiant = $this->request->attributes->get(AssignRequestId::ATTRIBUT);

        return is_string($identifiant) ? $identifiant : null;
    }
}
