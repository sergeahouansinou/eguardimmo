<?php

declare(strict_types=1);

namespace App\Shared\Audit;

use Closure;

/**
 * Décide si un opérateur peut lire le détail (avant/après, contexte, auteur) des entrées du journal qui portent une organisation (ADR 0016,
 * amendement du lot 3 de l'ADR 0033). Le module qui détient le consentement enregistre la règle ; sans règle, rien n'est divulgué.
 */
final class ActivityDisclosure
{
    /** @var (Closure(string, string): bool)|null */
    private ?Closure $regle = null;

    /**
     * @param  Closure(string, string): bool  $regle  (identifiant de l'opérateur, identifiant de l'organisation)
     */
    public function useRule(Closure $regle): void
    {
        $this->regle = $regle;
    }

    public function allows(string $operateurId, string $organisationId): bool
    {
        return $this->regle !== null && ($this->regle)($operateurId, $organisationId);
    }
}
