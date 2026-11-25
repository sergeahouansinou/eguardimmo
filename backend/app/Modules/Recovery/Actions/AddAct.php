<?php

declare(strict_types=1);

namespace App\Modules\Recovery\Actions;

use App\Modules\Recovery\Data\NewActData;
use App\Modules\Recovery\Enums\ActType;
use App\Modules\Recovery\Enums\ErrorCode;
use App\Modules\Recovery\Models\RecoveryAct;
use App\Modules\Recovery\Models\RecoveryCase;
use App\Shared\Audit\RecordAudit;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use InvalidArgumentException;

final readonly class AddAct
{
    public function __construct(private RecordAudit $audit) {}

    /**
     * Diligence manuelle du carnet ; `transmission` et `revocation` n'existent que par l'envoi et la révocation. Clé d'idempotence
     * facultative : même clé, même auteur et même contenu rejoués donnent l'acte déjà écrit, sans second acte ni second audit ;
     * même clé avec un autre contenu ou un autre dossier : 409.
     *
     * @return array{act: RecoveryAct, replayed: bool}
     */
    public function handle(RecoveryCase $case, NewActData $data, ?string $cle = null): array
    {
        if (! in_array($data->type, ActType::manual(), true)) {
            throw new InvalidArgumentException('Un acte système ne se saisit pas à la main.');
        }

        if ($data->performedOn < $case->opened_on->toDateString()) {
            throw ValidationException::withMessages(['performed_on' => ['La date de la diligence ne peut pas précéder l\'ouverture du dossier.']]);
        }

        try {
            return DB::transaction(function () use ($case, $data, $cle): array {
                $rejeu = $cle === null ? null : $this->existing($cle, $case, $data);

                if ($rejeu !== null) {
                    return ['act' => $rejeu, 'replayed' => true];
                }

                $acte = RecoveryAct::query()->create([
                    'case_id' => $case->id,
                    'type' => $data->type,
                    'performed_on' => $data->performedOn,
                    'author_user_id' => is_string(auth()->id()) ? auth()->id() : null,
                    'reference' => $data->reference,
                    'note' => $data->note,
                    'idempotency_key' => $cle,
                ]);

                $this->audit->handle('recovery.act.added', subject: $case, metadata: ['act_id' => $acte->id, 'type' => $data->type->value]);

                return ['act' => $acte, 'replayed' => false];
            });
        } catch (UniqueConstraintViolationException $erreur) {
            $rejeu = $cle === null ? null : $this->existing($cle, $case, $data);

            return $rejeu === null ? throw $erreur : ['act' => $rejeu, 'replayed' => true];
        }
    }

    private function existing(string $cle, RecoveryCase $case, NewActData $data): ?RecoveryAct
    {
        $existant = RecoveryAct::query()->where('author_user_id', auth()->id())->where('idempotency_key', $cle)->first();

        if ($existant === null) {
            return null;
        }

        if ($existant->case_id !== $case->id || $existant->type !== $data->type || $existant->performed_on->toDateString() !== $data->performedOn
            || $existant->reference !== $data->reference || $existant->note !== $data->note) {
            throw ErrorCode::IdempotencyKeyReused->problem();
        }

        return $existant;
    }
}
