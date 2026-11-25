<?php

declare(strict_types=1);

namespace App\Shared\Audience;

use Closure;
use LogicException;

/**
 * Registre des groupes de destinataires de la plateforme (ADR 0042) : le module qui possède le rattachement y enregistre sa requête.
 */
final class AudienceRegistry
{
    /** @var array<string, Closure(int|null): iterable<string>> */
    private array $audiences = [];

    /**
     * @param  Closure(int|null): iterable<string>  $accountIds  (jours d'inactivité) → identifiants de comptes
     */
    public function register(string $code, Closure $accountIds): void
    {
        $this->audiences[$code] = $accountIds;
    }

    /**
     * @return iterable<string>
     */
    public function accountIds(string $code, ?int $inactivityDays = null): iterable
    {
        return ($this->audiences[$code] ?? throw new LogicException("Groupe de destinataires sans module : {$code}."))($inactivityDays);
    }
}
