<?php

declare(strict_types=1);

namespace App\Shared\Audit;

use Illuminate\Database\Eloquent\Model;

final readonly class RecordModelChange
{
    public const CREATED = 'created';

    public const UPDATED = 'updated';

    public const DELETED = 'deleted';

    public const RESTORED = 'restored';

    public const MASQUE = '[masqué]';

    private const TOUJOURS_EXCLUS = ['created_at', 'updated_at', 'deleted_at'];

    public function __construct(private RecordAudit $audit) {}

    public function handle(Model $modele, string $evenement): void
    {
        $changements = $this->changements($modele, $evenement);

        if ($changements === [] && $evenement === self::UPDATED) {
            return;
        }

        $this->audit->handle($modele->getMorphClass().'.'.$evenement, subject: $modele, changes: $changements === [] ? null : $changements);
    }

    /**
     * @return array<string, array{old: mixed, new: mixed}>
     */
    private function changements(Model $modele, string $evenement): array
    {
        $actuels = $modele->getAttributes();

        $paires = match ($evenement) {
            self::CREATED => array_map(fn (mixed $v): array => ['old' => null, 'new' => $v], $actuels),
            self::DELETED => array_map(fn (mixed $v): array => ['old' => $v, 'new' => null], $actuels),
            self::UPDATED, self::RESTORED => $this->modifications($modele),
            default => [],
        };

        $exclus = [...self::TOUJOURS_EXCLUS, $modele->getKeyName(), ...$this->liste($modele, 'auditExcluded')];
        $masques = [...$modele->getHidden(), ...$this->chiffres($modele), ...$this->liste($modele, 'auditMasked')];
        $resultat = [];

        foreach ($paires as $attribut => $paire) {
            if (in_array($attribut, $exclus, true)) {
                continue;
            }

            $resultat[$attribut] = in_array($attribut, $masques, true)
                ? ['old' => $paire['old'] === null ? null : self::MASQUE, 'new' => $paire['new'] === null ? null : self::MASQUE]
                : $paire;
        }

        return $resultat;
    }

    /**
     * @return array<string, array{old: mixed, new: mixed}>
     */
    private function modifications(Model $modele): array
    {
        $precedents = $modele->getPrevious();
        $paires = [];

        foreach ($modele->getChanges() as $attribut => $nouveau) {
            $paires[$attribut] = ['old' => $precedents[$attribut] ?? null, 'new' => $nouveau];
        }

        return $paires;
    }

    /**
     * @return list<string>
     */
    private function chiffres(Model $modele): array
    {
        return array_keys(array_filter($modele->getCasts(), fn (string $cast): bool => str_starts_with($cast, 'encrypted')));
    }

    /**
     * @return list<string>
     */
    private function liste(Model $modele, string $methode): array
    {
        $valeur = method_exists($modele, $methode) ? $modele->{$methode}() : [];

        return is_array($valeur) ? array_values(array_filter($valeur, is_string(...))) : [];
    }
}
