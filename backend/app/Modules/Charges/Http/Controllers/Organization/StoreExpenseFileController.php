<?php

declare(strict_types=1);

namespace App\Modules\Charges\Http\Controllers\Organization;

use App\Modules\Charges\Actions\AttachExpenseFile;
use App\Modules\Charges\Http\Requests\UploadFileRequest;
use Illuminate\Http\JsonResponse;

final class StoreExpenseFileController
{
    public function __invoke(string $expense, UploadFileRequest $request, AttachExpenseFile $joindre): JsonResponse
    {
        $ligne = $joindre->handle($expense, $request->upload());

        return new JsonResponse(['data' => ['id' => $ligne->id, 'expense_id' => $ligne->expense_id, 'stored_file_id' => $ligne->stored_file_id]], 201);
    }
}
