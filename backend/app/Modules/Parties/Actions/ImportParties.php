<?php

declare(strict_types=1);

namespace App\Modules\Parties\Actions;

use App\Modules\Parties\Data\PartyImportResultData;
use App\Modules\Parties\Enums\ErrorCode;
use App\Modules\Parties\Enums\PartyKind;
use App\Modules\Parties\Models\PartyImport;
use App\Modules\Parties\Support\PartyInput;
use App\Modules\Parties\Support\PartyRules;
use App\Shared\Audit\RecordAudit;
use App\Shared\Http\ApiProblem;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

final readonly class ImportParties
{
    public const MAX_LIGNES = 500;

    private const MAX_LIGNES_SIGNALEES = 50;

    public function __construct(
        private CreateParty $creer,
        private RecordAudit $audit,
    ) {}

    /**
     * Tout ou rien : une ligne refusée annule tout l'import. Rejouable par `client_id` ; le même identifiant avec un autre contenu est refusé.
     *
     * @param  list<array<array-key, mixed>>  $lignes
     */
    public function handle(string $clientId, array $lignes, bool $allowDuplicates): PartyImportResultData
    {
        $empreinte = hash('sha256', json_encode([$lignes, $allowDuplicates], JSON_THROW_ON_ERROR));
        $existant = PartyImport::query()->where('client_id', $clientId)->first();

        if ($existant !== null) {
            return $this->rejouer($existant, $empreinte);
        }

        try {
            return DB::transaction(fn (): PartyImportResultData => $this->importer($clientId, $lignes, $allowDuplicates, $empreinte));
        } catch (UniqueConstraintViolationException $erreur) {
            return $this->rejouer(PartyImport::query()->where('client_id', $clientId)->firstOr(fn () => throw $erreur), $empreinte);
        }
    }

    /**
     * @param  list<array<array-key, mixed>>  $lignes
     */
    private function importer(string $clientId, array $lignes, bool $allowDuplicates, string $empreinte): PartyImportResultData
    {
        $erreurs = [];
        $doublons = [];
        $creees = [];
        $ligneDeFiche = [];

        foreach ($lignes as $index => $ligne) {
            $numero = $index + 1;

            try {
                $valeurs = $this->valider($ligne);
                $partie = $this->creer->handle(PartyInput::from($valeurs, $allowDuplicates));
                $creees[] = $partie->id;
                $ligneDeFiche[$partie->id] = $numero;
            } catch (ValidationException $e) {
                $erreurs[$numero] = $e->errors();
            } catch (ApiProblem $e) {
                if ($e->problemCode === ErrorCode::PartyPossibleDuplicate->value) {
                    $doublons[$numero] = $this->candidats($e, $ligneDeFiche);

                    continue;
                }

                $erreurs[$numero] = ['row' => [$e->getMessage()]];
            }
        }

        if ($erreurs !== []) {
            throw ErrorCode::PartyImportInvalid->problem([
                'rows' => $this->signaler($erreurs, fn (array $e, int $n): array => ['row' => $n, 'errors' => $e]),
                'rows_in_error' => count($erreurs),
            ]);
        }

        if ($doublons !== []) {
            throw ErrorCode::PartyPossibleDuplicate->problem([
                'rows' => $this->signaler($doublons, fn (array $c, int $n): array => ['row' => $n, ...$c]),
                'rows_in_error' => count($doublons),
            ]);
        }

        $import = PartyImport::query()->create([
            'client_id' => $clientId,
            'payload_hash' => $empreinte,
            'party_ids' => $creees,
            'row_count' => count($creees),
        ]);
        $this->audit->handle('parties.party.imported', metadata: ['count' => count($creees)], subject: $import);

        return new PartyImportResultData($import->id, count($creees), $creees, false);
    }

    /**
     * @param  array<array-key, mixed>  $ligne
     * @return array<string, mixed>
     *
     * @throws ValidationException
     */
    private function valider(array $ligne): array
    {
        $regles = [
            'kind' => ['required', Rule::enum(PartyKind::class)],
            ...Arr::except(PartyRules::identity(), ['custom_fields', 'contact_category_ids', 'contact_category_ids.*', 'tag_ids', 'tag_ids.*']),
            ...PartyRules::initialDetails(),
        ];

        /** @var array<string, mixed> $valides */
        $valides = Validator::make($ligne, $regles)->validate();

        return $valides;
    }

    /**
     * Une fiche créée plus haut dans le même fichier se signale par son numéro de ligne, jamais par un identifiant qui n'existera pas.
     *
     * @param  array<string, int>  $ligneDeFiche
     * @return array{candidates: list<array{id: string, display_name: string, reasons: list<string>}>, duplicate_of_rows: list<int>}
     */
    private function candidats(ApiProblem $e, array $ligneDeFiche): array
    {
        $candidats = [];
        $lignes = [];

        foreach ((array) ($e->extensions['candidates'] ?? []) as $c) {
            if (! is_array($c)) {
                continue;
            }

            $id = (string) $c['id'];

            if (isset($ligneDeFiche[$id])) {
                $lignes[] = $ligneDeFiche[$id];
            } else {
                $candidats[] = ['id' => $id, 'display_name' => (string) $c['display_name'], 'reasons' => array_values(array_map(strval(...), (array) $c['reasons']))];
            }
        }

        return ['candidates' => $candidats, 'duplicate_of_rows' => $lignes];
    }

    /**
     * @template T
     *
     * @param  array<int, T>  $parLigne
     * @param  callable(T, int): array<string, mixed>  $forme
     * @return list<array<string, mixed>>
     */
    private function signaler(array $parLigne, callable $forme): array
    {
        $signalees = [];

        foreach (array_slice($parLigne, 0, self::MAX_LIGNES_SIGNALEES, true) as $numero => $contenu) {
            $signalees[] = $forme($contenu, $numero);
        }

        return $signalees;
    }

    private function rejouer(PartyImport $existant, string $empreinte): PartyImportResultData
    {
        if (! hash_equals($existant->payload_hash, $empreinte)) {
            throw ErrorCode::IdempotencyKeyReused->problem();
        }

        return new PartyImportResultData($existant->id, $existant->row_count, $existant->party_ids, true);
    }
}
