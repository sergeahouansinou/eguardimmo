<?php

declare(strict_types=1);

namespace App\Modules\Recovery\Actions;

use App\Modules\Recovery\Data\NewActData;
use App\Modules\Recovery\Enums\ActType;
use App\Modules\Recovery\Models\RecoveryAct;
use App\Modules\Recovery\Models\RecoveryCase;
use App\Shared\Audit\RecordAudit;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use InvalidArgumentException;

final readonly class AddAct
{
    public function __construct(private RecordAudit $audit) {}

    /**
     * Diligence manuelle du carnet ; `transmission` et `revocation` n'existent que par l'envoi et la révocation.
     */
    public function handle(RecoveryCase $case, NewActData $data): RecoveryAct
    {
        if (! in_array($data->type, ActType::manual(), true)) {
            throw new InvalidArgumentException('Un acte système ne se saisit pas à la main.');
        }

        if ($data->performedOn < $case->opened_on->toDateString()) {
            throw ValidationException::withMessages(['performed_on' => ['La date de la diligence ne peut pas précéder l\'ouverture du dossier.']]);
        }

        return DB::transaction(function () use ($case, $data): RecoveryAct {
            $acte = RecoveryAct::query()->create([
                'case_id' => $case->id,
                'type' => $data->type,
                'performed_on' => $data->performedOn,
                'author_user_id' => is_string(auth()->id()) ? auth()->id() : null,
                'reference' => $data->reference,
                'note' => $data->note,
            ]);

            $this->audit->handle('recovery.act.added', subject: $case, metadata: ['act_id' => $acte->id, 'type' => $data->type->value]);

            return $acte;
        });
    }
}
