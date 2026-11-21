<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Support;

/**
 * Libellés des objets liés à une page de fils, résolus en bloc (une lecture par organisation, jamais une par ligne).
 */
final readonly class ThreadLookups
{
    /**
     * @param  array<string, string>  $organizations  nom par organisation
     * @param  array<string, string>  $leases  référence par bail
     * @param  array<string, string>  $mandates  référence par mandat
     * @param  array<string, string>  $parties  nom par fiche
     * @param  array<string, string>  $assignees  nom par compte
     */
    public function __construct(
        public array $organizations = [],
        public array $leases = [],
        public array $mandates = [],
        public array $parties = [],
        public array $assignees = [],
    ) {}
}
