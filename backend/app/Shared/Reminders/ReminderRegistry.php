<?php

declare(strict_types=1);

namespace App\Shared\Reminders;

use Closure;
use LogicException;

/**
 * Registre des déclencheurs de rappel (ADR 0042) : chaque module interroge ses propres tables et s'y enregistre.
 */
final class ReminderRegistry
{
    /** @var array<string, Closure(ReminderWindow): iterable<ReminderHit>> */
    private array $sources = [];

    /** @var (Closure(ReminderWindow): iterable<ReminderHit>)|null */
    private ?Closure $organizations = null;

    /** @var (Closure(): list<string>)|null */
    private ?Closure $suspended = null;

    /**
     * @param  Closure(ReminderWindow): iterable<ReminderHit>  $hits
     */
    public function register(string $code, Closure $hits): void
    {
        $this->sources[$code] = $hits;
    }

    /**
     * @return iterable<ReminderHit>
     */
    public function hits(string $code, ReminderWindow $window): iterable
    {
        return ($this->sources[$code] ?? throw new LogicException("Rappel sans déclencheur : {$code}."))($window);
    }

    /**
     * Les modules sans lien avec Organizations y lisent les organisations créées dans la fenêtre.
     *
     * @param  Closure(ReminderWindow): iterable<ReminderHit>  $resolver
     */
    public function resolveOrganizations(Closure $resolver): void
    {
        $this->organizations = $resolver;
    }

    /**
     * @return iterable<ReminderHit>
     */
    public function organizationsCreated(ReminderWindow $window): iterable
    {
        return ($this->organizations ?? throw new LogicException('Aucun résolveur d\'organisations enregistré.'))($window);
    }

    /**
     * @param  Closure(): list<string>  $resolver
     */
    public function resolveSuspendedOrganizations(Closure $resolver): void
    {
        $this->suspended = $resolver;
    }

    /**
     * @return list<string>
     */
    public function suspendedOrganizations(): array
    {
        return ($this->suspended ?? throw new LogicException('Aucun résolveur d\'organisations suspendues enregistré.'))();
    }
}
