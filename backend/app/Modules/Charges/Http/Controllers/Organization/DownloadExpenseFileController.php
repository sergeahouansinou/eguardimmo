<?php

declare(strict_types=1);

namespace App\Modules\Charges\Http\Controllers\Organization;

use App\Modules\Charges\Enums\ErrorCode;
use App\Modules\Charges\Models\ExpenseFile;
use App\Modules\Charges\Queries\Expenses;
use App\Modules\Documents\PublicApi\DocumentStore;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\StreamedResponse;

final class DownloadExpenseFileController
{
    public function __invoke(string $expense, string $file, Expenses $depenses, DocumentStore $documents): StreamedResponse
    {
        $depense = $depenses->get($expense);
        $ligne = Str::isUuid($file) ? ExpenseFile::query()->whereKey($file)->where('expense_id', $depense->id)->first() : null;

        return $documents->stream(($ligne ?? throw ErrorCode::FileNotFound->problem())->stored_file_id);
    }
}
