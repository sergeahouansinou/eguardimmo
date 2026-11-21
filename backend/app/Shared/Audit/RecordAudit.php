<?php

declare(strict_types=1);

namespace App\Shared\Audit;

use App\Shared\Http\AssignRequestId;
use App\Shared\Http\ConsoleRelay;
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
            'changes' => $changes === null ? null : self::utf8($changes),
            'metadata' => self::utf8($metadata),
            'request_id' => $this->identifiantDeRequete(),
            'route' => $route instanceof Route ? $route->getName() : null,
            'ip' => ConsoleRelay::ipClient($this->request),
            'user_agent' => $this->userAgent(),
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

    /**
     * @template T of array<array-key, mixed>
     *
     * @param  T  $valeurs
     * @return T
     */
    private static function utf8(array $valeurs): array
    {
        array_walk_recursive($valeurs, function (mixed &$valeur): void {
            if (is_string($valeur)) {
                $valeur = mb_scrub($valeur, 'UTF-8');
            }
        });

        return $valeurs;
    }

    private function userAgent(): ?string
    {
        $brut = mb_scrub((string) $this->request->userAgent(), 'UTF-8');
        $lisible = (string) preg_replace('/[\x00-\x1F\x7F]/u', '', $brut);

        return Str::limit($lisible, self::USER_AGENT_MAX, '') ?: null;
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

        if ($subject !== null && method_exists($subject, 'auditOrganizationId')) {
            $propre = $subject->auditOrganizationId();

            if (is_string($propre)) {
                return $propre;
            }
        }

        return $this->organisation->has() ? $this->organisation->id() : null;
    }

    private function identifiantDeRequete(): ?string
    {
        $identifiant = $this->request->attributes->get(AssignRequestId::ATTRIBUT);

        return is_string($identifiant) ? $identifiant : null;
    }
}
