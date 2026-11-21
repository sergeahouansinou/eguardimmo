<?php

declare(strict_types=1);

namespace App\Modules\Charges\Actions;

use App\Modules\Charges\Enums\ErrorCode;
use App\Modules\Charges\Enums\ExpenseStatus;
use App\Modules\Charges\Models\Expense;
use App\Modules\Charges\Models\ExpenseFile;
use App\Modules\Charges\Support\ExpenseAttachments;
use App\Modules\Charges\Support\Locks;
use App\Modules\Charges\Support\Operators;
use App\Shared\Audit\RecordAudit;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;

final readonly class AttachExpenseFile
{
    public function __construct(
        private Locks $verrous,
        private ExpenseAttachments $pieces,
        private Operators $operateurs,
        private RecordAudit $audit,
    ) {}

    public function handle(string $expenseId, UploadedFile $fichier): ExpenseFile
    {
        return DB::transaction(function () use ($expenseId, $fichier): ExpenseFile {
            $depense = $this->verrous->expense($expenseId);

            if ($depense->status === ExpenseStatus::Cancelled) {
                throw ErrorCode::FileInvalid->problem('Une dépense annulée n\'accepte plus de pièce.');
            }

            $id = $this->pieces->store($fichier, $depense->id);
            $ligne = ExpenseFile::query()->create(['expense_id' => $depense->id, 'stored_file_id' => $id, 'created_by_user_id' => $this->operateurs->userId()]);
            $this->principale($depense, $id);
            $this->audit->handle('charges.expense.file_added', subject: $depense);

            return $ligne;
        });
    }

    private function principale(Expense $depense, string $fileId): void
    {
        if ($depense->stored_file_id === null) {
            $depense->forceFill(['stored_file_id' => $fileId, 'lock_version' => $depense->lock_version + 1])->save();
        }
    }
}
