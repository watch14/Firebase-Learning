import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { storage, db } from "@/config/firebase";
import {
  ref,
  uploadBytes,
  listAll,
  getDownloadURL,
  deleteObject,
  getMetadata,
} from "firebase/storage";
import {
  collection,
  getDocs,
  updateDoc,
  doc,
  arrayUnion,
  arrayRemove,
  deleteDoc,
} from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Search,
  File,
  Trash2,
  FileText,
  LayoutGrid,
  StretchHorizontal,
  Edit,
  Loader2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import Loading from "./ui/loader";

export default function Files() {
  const { currentUser } = useAuth();
  const [fileUpload, setFileUpload] = useState(null);
  const [fileURLs, setFileURLs] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    if (currentUser) {
      setLoading(true);
      await fetchCategories();
      await fetchFiles();
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const fetchCategories = async () => {
    try {
      const categoryRef = collection(db, "category");
      const data = await getDocs(categoryRef);
      const categoryList = data.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .filter((category) => category.createdBy === currentUser?.uid);
      setCategories(categoryList);
    } catch (error) {
      console.error("Error fetching categories: ", error);
      toast({
        title: "Error",
        description: "Failed to fetch categories",
        variant: "destructive",
      });
    }
  };

  const fetchFiles = async () => {
    try {
      const user = currentUser.displayName;
      const storageRef = ref(storage, `${user}'s Files/`);
      const fileList = await listAll(storageRef);

      const urls = await Promise.all(
        fileList.items.map(async (item) => {
          const downloadURL = await getDownloadURL(item);
          const category = await getFileCategory(downloadURL);
          const metadata = await getMetadata(item);
          return {
            name: item.name,
            url: downloadURL,
            category: category,
            size: formatFileSize(metadata.size),
          };
        })
      );

      setFileURLs(urls);
    } catch (error) {
      console.error("Error fetching files: ", error);
      toast({
        title: "Error",
        description: "Failed to fetch files",
        variant: "destructive",
      });
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const getFileCategory = async (fileUrl) => {
    for (const category of categories) {
      if (category.files && category.files.includes(fileUrl)) {
        return category.id;
      }
    }
    return null;
  };

  const uploadFile = async () => {
    if (!fileUpload || !selectedCategory) {
      toast({
        title: "Error",
        description: "Please select a file and a category",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    try {
      const user = currentUser.displayName;
      const storageRef = ref(storage, `${user}'s Files/${fileUpload.name}`);

      await uploadBytes(storageRef, fileUpload);
      const downloadURL = await getDownloadURL(storageRef);

      // Add file URL to the selected category
      const categoryRef = doc(db, "category", selectedCategory);
      await updateDoc(categoryRef, {
        files: arrayUnion(downloadURL),
      });

      await fetchFiles();
      setFileUpload(null);
      setSelectedCategory("");
      setDialogOpen(false);
      toast({ title: "Success", description: "File uploaded successfully" });
    } catch (error) {
      console.error("Error uploading file: ", error);
      toast({
        title: "Error",
        description: "Failed to upload file",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const deleteFile = async (fileName, fileUrl, categoryId) => {
    try {
      const user = currentUser.displayName;
      const fileRef = ref(storage, `${user}'s Files/${fileName}`);
      await deleteObject(fileRef);

      // Remove file URL from the category
      if (categoryId) {
        const categoryRef = doc(db, "category", categoryId);
        await updateDoc(categoryRef, {
          files: arrayRemove(fileUrl),
        });
      }

      // Remove file link from categoryAttachment
      const categoryRef = collection(db, "categoryAttachment");
      const querySnapshot = await getDocs(categoryRef);
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.fileUrl === fileUrl) {
          deleteDoc(doc.ref);
        }
      });

      await fetchCategories();
      await fetchFiles();
      toast({ title: "Success", description: "File deleted successfully" });
    } catch (error) {
      console.error("Error deleting file: ", error);
      toast({
        title: "Error",
        description: "Failed to delete file",
        variant: "destructive",
      });
    }
  };

  const updateFileCategory = async (fileUrl, oldCategoryId, newCategoryId) => {
    try {
      if (oldCategoryId) {
        const oldCategoryRef = doc(db, "category", oldCategoryId);
        await updateDoc(oldCategoryRef, {
          files: arrayRemove(fileUrl),
        });
      }

      const newCategoryRef = doc(db, "category", newCategoryId);
      await updateDoc(newCategoryRef, {
        files: arrayUnion(fileUrl),
      });
      await fetchCategories();
      await fetchFiles();
      toast({
        title: "Success",
        description: "File category updated successfully",
      });
    } catch (error) {
      console.error("Error updating file category: ", error);
      toast({
        title: "Error",
        description: "Failed to update file category",
        variant: "destructive",
      });
    }
  };

  const renderFilePreview = (file) => {
    const fileType = file.name.split(".").pop().toLowerCase();

    if (["jpg", "jpeg", "png", "gif"].includes(fileType)) {
      return (
        <img
          src={file.url}
          alt={file.name}
          className="w-full h-full object-cover rounded overflow-hidden"
        />
      );
    } else {
      return <FileText className="w-16 h-16 text-primary" />;
    }
  };

  const filteredFiles = fileURLs.filter(
    (file) =>
      file.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
      (categoryFilter === "all" || file.category === categoryFilter)
  );

  if (loading) {
    return <Loading />;
  }

  return (
    <div className="container min-w-full px-4 py-8">
      <div className="flex justify-between items-center mb-8 w-full">
        <div className="flex items-center gap-3">
          <File className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Files</h1>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Upload File
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload File</DialogTitle>
              <DialogDescription>
                Choose a file to upload to your SaveSpace and select a category.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="file-upload" className="text-right">
                  File
                </label>
                <Input
                  id="file-upload"
                  type="file"
                  className="col-span-3"
                  onChange={(e) => setFileUpload(e.target.files[0])}
                  disabled={uploading}
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="category" className="text-right">
                  Category
                </label>
                <Select
                  onValueChange={setSelectedCategory}
                  value={selectedCategory}
                  disabled={uploading}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" onClick={uploadFile} disabled={uploading}>
                {uploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  "Upload File"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <div className="relative flex-grow">
          <Search className="absolute left-2 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search files..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 h-full"
          />
          {searchTerm && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-2 top-2"
              onClick={() => setSearchTerm("")}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        <Select onValueChange={setCategoryFilter} value={categoryFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filter by category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="grid" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="grid">
            <LayoutGrid className="h-4 w-4 mr-2" />
            Grid View
          </TabsTrigger>
          <TabsTrigger value="list">
            <StretchHorizontal className="h-4 w-4 mr-2" />
            List View
          </TabsTrigger>
        </TabsList>

        <TabsContent value="grid">
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredFiles.map((file, index) => (
              <FileCard
                key={index}
                file={file}
                deleteFile={deleteFile}
                renderFilePreview={renderFilePreview}
                categories={categories}
                updateFileCategory={updateFileCategory}
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="list">
          <div className="space-y-4 overflow-hidden">
            {filteredFiles.map((file, index) => (
              <FileListItem
                key={index}
                file={file}
                deleteFile={deleteFile}
                renderFilePreview={renderFilePreview}
                categories={categories}
                updateFileCategory={updateFileCategory}
              />
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {filteredFiles.length === 0 && (
        <Card className="mt-8">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <File className="h-12  w-12 text-muted-foreground mb-4" />
            <h2 className="text-lg font-semibold mb-2">No Files Found</h2>
            <p className="text-muted-foreground text-center">
              {searchTerm || categoryFilter !== "all"
                ? "No files match your search or category filter. Try different criteria."
                : "Upload a new file to get started."}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function FileCard({
  file,
  deleteFile,
  renderFilePreview,
  categories,
  updateFileCategory,
}) {
  const [isEditing, setIsEditing] = useState(false);

  const getCategoryName = (categoryId) => {
    return categories.find((c) => c.id === categoryId)?.name ?? "Uncategorized";
  };

  return (
    <Card className="flex flex-col">
      <CardHeader className="p-4">
        <CardTitle className="flex items-center text-sm font-medium">
          <File className="mr-2 h-4 w-4 text-primary" />
          <span className="truncate">{file.name}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-grow p-4">
        <div className="flex justify-center items-center h-32 bg-muted rounded-md">
          {renderFilePreview(file)}
        </div>
        <div className="mt-4 flex justify-between items-center">
          <Badge variant="secondary">{getCategoryName(file.category)}</Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsEditing(!isEditing)}
          >
            <Edit className="h-4 w-4" />
          </Button>
        </div>
        {isEditing && (
          <Select
            defaultValue={file.category}
            onValueChange={(newCategoryId) => {
              updateFileCategory(file.url, file.category, newCategoryId);
              setIsEditing(false);
            }}
          >
            <SelectTrigger className="w-full mt-2">
              <SelectValue placeholder="Select a category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <p className="text-sm text-muted-foreground mt-2">Size: {file.size}</p>
      </CardContent>
      <CardFooter className="flex justify-between p-4">
        <Button variant="outline" size="sm" asChild>
          <a href={file.url} target="_blank" rel="noopener noreferrer">
            View
          </a>
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm">
              <Trash2 className="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete this
                file.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={() => deleteFile(file.name, file.url, file.category)}
              >
                <Trash2 className="mr-2 h-4 w-4" /> Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardFooter>
    </Card>
  );
}

function FileListItem({
  file,
  deleteFile,
  renderFilePreview,
  categories,
  updateFileCategory,
}) {
  const [isEditing, setIsEditing] = useState(false);

  const getCategoryName = (categoryId) => {
    const category = categories.find((c) => c.id === categoryId);
    return category ? category.name : "Uncategorized";
  };

  return (
    <Card>
      <CardContent className="flex items-center justify-between py-4">
        <div className="flex items-center">
          <div className="mr-4 w-16 h-16 flex items-center justify-center bg-muted rounded-md">
            {renderFilePreview(file)}
          </div>
          <div>
            <span className="font-medium">{file.name}</span>
            <p className="text-sm text-muted-foreground">Size: {file.size}</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant="secondary">{getCategoryName(file.category)}</Badge>
          {isEditing ? (
            <Select
              defaultValue={file.category}
              onValueChange={(newCategoryId) => {
                updateFileCategory(file.url, file.category, newCategoryId);
                setIsEditing(false);
              }}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsEditing(true)}
            >
              <Edit className="h-4 w-4" />
            </Button>
          )}
          <Button variant="outline" size="sm" asChild>
            <a href={file.url} target="_blank" rel="noopener noreferrer">
              View
            </a>
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete
                  this file.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  onClick={() => deleteFile(file.name, file.url, file.category)}
                >
                  <Trash2 className="mr-2 h-4 w-4" /> Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}
